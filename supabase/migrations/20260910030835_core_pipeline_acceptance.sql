-- Preserve historical results while enforcing current enrollment and batch access.
create function private.attempt_access(target_test uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.tests t where t.id=target_test and private.enrolled(t.program_id) and (not exists(select 1 from public.test_batches b where b.test_id=t.id) or exists(select 1 from public.test_batches b where b.test_id=t.id and private.enrolled(t.program_id,b.batch_id))))
$$;
revoke all on function private.attempt_access(uuid) from public,anon,authenticated;
create function public.core_test_summary(test_slug text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',t.id,'title',t.title,'slug',t.slug,'max_attempts',t.max_attempts,'duration_minutes',t.duration_minutes,'question_count',t.question_count,'total_marks',t.total_marks,'can_start',private.test_access(t.id)) from public.tests t where t.slug=test_slug and coalesce(private.active_role(),'')='student' and private.attempt_access(t.id) and (private.test_access(t.id) or exists(select 1 from public.test_attempts a where a.test_id=t.id and a.student_id=auth.uid()))
$$;
-- A test author can select their assigned bank without gaining question editing or answer-key access.
create function public.core_test_bank() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'prompt',q.prompt,'type',q.type,'status',q.status,'exam_id',q.exam_id,'program_id',q.program_id,'subject_id',q.subject_id,'chapter_id',q.chapter_id,'topic_id',q.topic_id,'difficulty',q.difficulty,'marks',q.marks,'options','[]'::jsonb)),'[]') from public.questions q where coalesce(private.active_role(),'')='teacher' and q.status='active' and public.teacher_has_assignment(q.exam_id,q.program_id,q.subject_id,'tests')
$$;
revoke all on function public.core_test_summary(text),public.core_test_bank() from public,anon;
grant execute on function public.core_test_summary(text),public.core_test_bank() to authenticated;
create or replace function public.has_program_access(target_program uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_admin() or private.enrolled(target_program) or (coalesce(private.active_role(),'')='teacher' and exists(select 1 from public.programs p join public.faculty_assignments f on f.faculty_id=auth.uid() where p.id=target_program and (f.program_id is null or f.program_id=p.id) and (f.exam_id is null or f.exam_id=p.exam_id) and (f.subject_id is null or exists(select 1 from public.program_subjects ps where ps.program_id=p.id and ps.subject_id=f.subject_id))))
$$;
drop policy subject_read on public.subjects;
create policy subject_read on public.subjects for select to authenticated using(public.is_admin() or (coalesce(private.active_role(),'')='student' and exists(select 1 from public.program_subjects ps where ps.subject_id=subjects.id)) or (coalesce(private.active_role(),'')='teacher' and exists(select 1 from public.faculty_assignments f where f.faculty_id=auth.uid() and (f.subject_id is null or f.subject_id=subjects.id))));
drop policy chapter_read on public.chapters;
create policy chapter_read on public.chapters for select to authenticated using(public.is_admin() or (exists(select 1 from public.subjects s where s.id=chapters.subject_id) and (program_id is null or public.has_program_access(program_id))));
drop policy topic_read on public.topics;
create policy topic_read on public.topics for select to authenticated using(public.is_admin() or (exists(select 1 from public.subjects s where s.id=topics.subject_id) and (program_id is null or public.has_program_access(program_id))));

create or replace function public.submit_test_attempt(target_attempt uuid) returns numeric language plpgsql security definer set search_path='' as $$
declare a public.test_attempts; q jsonb; chosen uuid[]; keys uuid[]; good boolean; earned numeric; total numeric:=0; right_n integer:=0; wrong_n integer:=0; blank_n integer:=0; negative numeric:=0;
begin
 select * into a from public.test_attempts where id=target_attempt and student_id=auth.uid() for update;
 if coalesce(private.active_role(),'') is distinct from 'student' or a.id is null or not private.attempt_access(a.test_id) then raise exception 'Attempt access denied'; end if;
 if a.status<>'in_progress' then return case when (select (review_settings->>'show_results')::boolean from private.attempt_snapshots where attempt_id=a.id) then a.score else null end; end if;
 for q in select x from private.attempt_snapshots s,jsonb_array_elements(s.questions) x where s.attempt_id=a.id loop
 select selected_option_ids into chosen from public.attempt_answers where attempt_id=a.id and question_id=(q->>'id')::uuid;
 select array_agg(x::uuid order by x::uuid) into keys from jsonb_array_elements_text(q->'correct_ids') x;
 if coalesce(cardinality(chosen),0)=0 then blank_n:=blank_n+1; earned:=0; good:=null;
 else good:=keys=(select array_agg(x order by x) from unnest(chosen) x); if good then right_n:=right_n+1; earned:=(q->>'marks')::numeric; else wrong_n:=wrong_n+1; earned:=-(q->>'negative_marks')::numeric; negative:=negative-earned; end if; end if;
 total:=total+earned; update public.attempt_answers set is_correct=good,marks_awarded=earned where attempt_id=a.id and question_id=(q->>'id')::uuid;
 end loop;
 update public.test_attempts set score=total,status='submitted',submitted_at=now(),correct_count=right_n,incorrect_count=wrong_n,unanswered_count=blank_n,negative_marks_total=negative where id=a.id;
 return case when (select (review_settings->>'show_results')::boolean from private.attempt_snapshots where attempt_id=a.id) then total else null end;
end $$;

create or replace function public.core_attempt_history(target_test uuid default null) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'test_id',a.test_id,'status',a.status,'started_at',a.started_at,'expires_at',a.expires_at,'submitted_at',a.submitted_at,'score',case when (s.review_settings->>'show_results')::boolean then a.score else null end) order by a.started_at desc),'[]') from public.test_attempts a join private.attempt_snapshots s on s.attempt_id=a.id where coalesce(private.active_role(),'')='student' and a.student_id=auth.uid() and (target_test is null or a.test_id=target_test) and private.attempt_access(a.test_id)
$$;

create or replace function public.core_attempt_payload(target_attempt uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.test_attempts; s private.attempt_snapshots;
begin
 select * into a from public.test_attempts where id=target_attempt and student_id=auth.uid();
 if coalesce(private.active_role(),'') is distinct from 'student' or a.id is null or not private.test_access(a.test_id) then raise exception 'Attempt access denied'; end if;
 if a.status='in_progress' and a.expires_at<=now() then perform public.submit_test_attempt(a.id); select * into a from public.test_attempts where id=a.id; end if;
 select * into s from private.attempt_snapshots where attempt_id=a.id;
 return jsonb_build_object('id',a.id,'status',a.status,'expires_at',a.expires_at,'option_order',a.option_order,'questions',case when a.status='in_progress' then (select jsonb_agg(q-'correct_ids'-'explanation'-'explanation_image_path') from jsonb_array_elements(s.questions) q) else '[]'::jsonb end,'answers',(select coalesce(jsonb_object_agg(question_id,selected_option_ids),'{}') from public.attempt_answers where attempt_id=a.id));
end $$;

create or replace function public.get_test_review(target_attempt uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('status',a.status,'results_visible',(s.review_settings->>'show_results')::boolean,'score',case when (s.review_settings->>'show_results')::boolean then a.score end,'total_marks',s.total_marks,'answers',case when (s.review_settings->>'show_answers')::boolean then (select jsonb_agg(jsonb_build_object('question_id',q->>'id','prompt',q->>'prompt','options',q->'options','stem_image_path',q->>'stem_image_path','selected_option_ids',coalesce(to_jsonb(aa.selected_option_ids),'[]'),'correct_option_ids',q->'correct_ids','marks_awarded',coalesce(aa.marks_awarded,0),'explanation',case when (s.review_settings->>'show_explanations')::boolean then q->>'explanation' end,'explanation_image_path',case when (s.review_settings->>'show_explanations')::boolean then q->>'explanation_image_path' end)) from jsonb_array_elements(s.questions) q left join public.attempt_answers aa on aa.attempt_id=a.id and aa.question_id=(q->>'id')::uuid) else '[]'::jsonb end)
 from public.test_attempts a join private.attempt_snapshots s on s.attempt_id=a.id where a.id=target_attempt and a.student_id=auth.uid() and coalesce(private.active_role(),'')='student' and a.status<>'in_progress' and private.attempt_access(a.test_id)
$$;

create or replace function private.image_access(path text) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_admin() or (coalesce(private.active_role(),'')='teacher' and (split_part(path,'/',1)=auth.uid()::text or exists(select 1 from public.questions q where (q.stem_image_path=path or q.explanation_image_path=path) and public.teacher_has_assignment(q.exam_id,q.program_id,q.subject_id,'questions'))))
 or (coalesce(private.active_role(),'')='student' and exists(select 1 from private.attempt_snapshots s join public.test_attempts a on a.id=s.attempt_id,jsonb_array_elements(s.questions) q where a.student_id=auth.uid() and private.attempt_access(a.test_id) and (q->>'stem_image_path'=path or (a.status<>'in_progress' and (s.review_settings->>'show_answers')::boolean and (s.review_settings->>'show_explanations')::boolean and q->>'explanation_image_path'=path))))
$$;

create or replace function public.core_save_content(value jsonb,batch_ids uuid[]) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.learning_content; old public.learning_content;
begin
 c:=jsonb_populate_record(null::public.learning_content,value); c.id:=coalesce(c.id,gen_random_uuid());
 select * into old from public.learning_content where id=c.id for update;
 if not public.teacher_has_assignment(c.exam_id,c.program_id,c.subject_id,'content') or not private.teacher_batches(batch_ids) or (old.id is not null and not private.content_access(old.id,true)) then raise exception 'Content permission denied'; end if;
 perform private.validate_taxonomy(c.exam_id,c.program_id,c.subject_id,c.chapter_id,c.topic_id);
 if c.program_id is null or c.subject_id is null or length(btrim(coalesce(c.title,'')))=0 then raise exception 'Title, program and subject are required'; end if;
 if exists(select 1 from unnest(batch_ids) b where not exists(select 1 from public.batches x where x.id=b and x.program_id=c.program_id)) then raise exception 'Batch belongs to another program'; end if;
 if c.storage_path is not null and (c.storage_bucket<>'learning-content' or not exists(select 1 from storage.objects o where o.bucket_id=c.storage_bucket and o.name=c.storage_path and (public.is_admin() or o.owner_id=auth.uid()::text or c.storage_path=old.storage_path))) then raise exception 'Uploaded file is unavailable'; end if;
 if c.kind<>'note' and c.storage_path is null and coalesce(c.external_url,'') !~ '^https://' then raise exception 'Provide an uploaded file or HTTPS source'; end if;
 perform pg_advisory_xact_lock(hashtextextended(c.program_id::text,1));
 insert into public.learning_content(id,slug,title,kind,description,exam_id,program_id,subject_id,chapter_id,topic_id,faculty_id,external_url,storage_bucket,storage_path,mime_type,byte_size,status,allow_download,display_order)
 values(c.id,coalesce(old.slug,'content-'||c.id),c.title,c.kind,c.description,c.exam_id,c.program_id,c.subject_id,c.chapter_id,c.topic_id,c.faculty_id,c.external_url,c.storage_bucket,c.storage_path,c.mime_type,c.byte_size,coalesce(c.status,'draft'),coalesce(c.allow_download,false),case when old.program_id=c.program_id then old.display_order else coalesce((select max(display_order)+1 from public.learning_content where program_id=c.program_id),0) end)
 on conflict(id) do update set title=excluded.title,kind=excluded.kind,description=excluded.description,exam_id=excluded.exam_id,program_id=excluded.program_id,subject_id=excluded.subject_id,chapter_id=excluded.chapter_id,topic_id=excluded.topic_id,faculty_id=excluded.faculty_id,external_url=excluded.external_url,storage_bucket=excluded.storage_bucket,storage_path=excluded.storage_path,mime_type=excluded.mime_type,byte_size=excluded.byte_size,status=excluded.status,allow_download=excluded.allow_download,display_order=excluded.display_order,updated_at=now();
 delete from public.content_batch_access where content_id=c.id; insert into public.content_batch_access select c.id,x from unnest(batch_ids) x;
 return c.id;
end $$;

create or replace function private.image_access(path text) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_admin() or (coalesce(private.active_role(),'')='teacher' and (split_part(path,'/',1)=auth.uid()::text or exists(select 1 from public.questions q where (q.stem_image_path=path or q.explanation_image_path=path) and public.teacher_has_assignment(q.exam_id,q.program_id,q.subject_id,'questions'))))
 or (coalesce(private.active_role(),'')='student' and exists(select 1 from private.attempt_snapshots s join public.test_attempts a on a.id=s.attempt_id,jsonb_array_elements(s.questions) q where a.student_id=auth.uid() and private.attempt_access(a.test_id) and (q->>'stem_image_path'=path or (a.status<>'in_progress' and (s.review_settings->>'show_answers')::boolean and (s.review_settings->>'show_explanations')::boolean and q->>'explanation_image_path'=path))))
$$;

create or replace function public.core_save_content(value jsonb,batch_ids uuid[]) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.learning_content; old public.learning_content;
begin
 c:=jsonb_populate_record(null::public.learning_content,value); c.id:=coalesce(c.id,gen_random_uuid());
 select * into old from public.learning_content where id=c.id for update;
 if not public.teacher_has_assignment(c.exam_id,c.program_id,c.subject_id,'content') or not private.teacher_batches(batch_ids) or (old.id is not null and not private.content_access(old.id,true)) then raise exception 'Content permission denied'; end if;
 perform private.validate_taxonomy(c.exam_id,c.program_id,c.subject_id,c.chapter_id,c.topic_id);
 if c.program_id is null or c.subject_id is null or length(btrim(coalesce(c.title,'')))=0 then raise exception 'Title, program and subject are required'; end if;
 if exists(select 1 from unnest(batch_ids) b where not exists(select 1 from public.batches x where x.id=b and x.program_id=c.program_id)) then raise exception 'Batch belongs to another program'; end if;
 if c.storage_path is not null and (c.storage_bucket<>'learning-content' or not exists(select 1 from storage.objects o where o.bucket_id=c.storage_bucket and o.name=c.storage_path and (public.is_admin() or o.owner_id=auth.uid()::text or c.storage_path=old.storage_path))) then raise exception 'Uploaded file is unavailable'; end if;
 if c.kind<>'note' and c.storage_path is null and coalesce(c.external_url,'') !~ '^https://' then raise exception 'Provide an uploaded file or HTTPS source'; end if;
 perform pg_advisory_xact_lock(hashtextextended(c.program_id::text,1));
 insert into public.learning_content(id,slug,title,kind,description,exam_id,program_id,subject_id,chapter_id,topic_id,faculty_id,external_url,storage_bucket,storage_path,mime_type,byte_size,status,allow_download,display_order)
 values(c.id,coalesce(old.slug,'content-'||c.id),c.title,c.kind,c.description,c.exam_id,c.program_id,c.subject_id,c.chapter_id,c.topic_id,c.faculty_id,c.external_url,c.storage_bucket,c.storage_path,c.mime_type,c.byte_size,coalesce(c.status,'draft'),coalesce(c.allow_download,false),case when old.program_id=c.program_id then old.display_order else coalesce((select max(display_order)+1 from public.learning_content where program_id=c.program_id),0) end)
 on conflict(id) do update set title=excluded.title,kind=excluded.kind,description=excluded.description,exam_id=excluded.exam_id,program_id=excluded.program_id,subject_id=excluded.subject_id,chapter_id=excluded.chapter_id,topic_id=excluded.topic_id,faculty_id=excluded.faculty_id,external_url=excluded.external_url,storage_bucket=excluded.storage_bucket,storage_path=excluded.storage_path,mime_type=excluded.mime_type,byte_size=excluded.byte_size,status=excluded.status,allow_download=excluded.allow_download,display_order=excluded.display_order,updated_at=now();
 delete from public.content_batch_access where content_id=c.id; insert into public.content_batch_access select c.id,x from unnest(batch_ids) x;
 return c.id;
end $$;

create or replace function public.core_save_question(value jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare q public.questions; old public.questions; o jsonb; oid uuid; n integer; correct_n integer;
begin
 q:=jsonb_populate_record(null::public.questions,value); q.id:=coalesce(q.id,gen_random_uuid());
 select * into old from public.questions where id=q.id for update;
 if not public.teacher_has_assignment(q.exam_id,q.program_id,q.subject_id,'questions') or (old.id is not null and not public.teacher_has_assignment(old.exam_id,old.program_id,old.subject_id,'questions')) then raise exception 'Question permission denied'; end if;
 perform private.validate_taxonomy(q.exam_id,q.program_id,q.subject_id,q.chapter_id,q.topic_id);
 if q.exam_id is null or q.subject_id is null or length(btrim(coalesce(q.prompt,'')))=0 then raise exception 'Exam, subject and question text are required'; end if;
 if q.type='match_following' then raise exception 'Matching is disabled pending a dedicated pair editor and scorer'; end if;
 if q.marks<=0 or q.marks is null or q.negative_marks<0 or q.negative_marks is null then raise exception 'Invalid marks'; end if;
 select count(*),count(*) filter(where (x->>'correct')::boolean) into n,correct_n from jsonb_array_elements(value->'options') x;
 if n<2 or correct_n<1 or (q.type<>'multiple_mcq' and correct_n<>1) or exists(select 1 from jsonb_array_elements(value->'options') x where length(btrim(coalesce(x->>'content','')))=0) then raise exception 'Provide valid options and correct answers'; end if;
 if q.type='true_false' and (n<>2 or not ((value->'options') @> '[{"content":"True"},{"content":"False"}]'::jsonb)) then raise exception 'True/False requires True and False options'; end if;
 if q.type='image_mcq' and q.stem_image_path is null then raise exception 'An image is required'; end if;
 if q.stem_image_path is not null and not exists(select 1 from storage.objects where bucket_id='question-media' and name=q.stem_image_path and (public.is_admin() or owner_id=auth.uid()::text or private.image_access(name))) then raise exception 'Question image upload is missing'; end if;
 if q.explanation_image_path is not null and not exists(select 1 from storage.objects where bucket_id='question-media' and name=q.explanation_image_path and (public.is_admin() or owner_id=auth.uid()::text or private.image_access(name))) then raise exception 'Explanation image upload is missing'; end if;
 insert into public.questions(id,exam_id,program_id,subject_id,chapter_id,topic_id,type,prompt,explanation,difficulty,marks,negative_marks,source_type,source_reference,exam_year,exam_session,source_label,status,stem_image_path,explanation_image_path)
 values(q.id,q.exam_id,q.program_id,q.subject_id,q.chapter_id,q.topic_id,q.type,q.prompt,q.explanation,q.difficulty,q.marks,q.negative_marks,coalesce(q.source_type,'standard'),q.source_reference,q.exam_year,q.exam_session,q.source_label,coalesce(q.status,'draft'),q.stem_image_path,q.explanation_image_path)
 on conflict(id) do update set exam_id=excluded.exam_id,program_id=excluded.program_id,subject_id=excluded.subject_id,chapter_id=excluded.chapter_id,topic_id=excluded.topic_id,type=excluded.type,prompt=excluded.prompt,explanation=excluded.explanation,difficulty=excluded.difficulty,marks=excluded.marks,negative_marks=excluded.negative_marks,source_type=excluded.source_type,source_reference=excluded.source_reference,exam_year=excluded.exam_year,exam_session=excluded.exam_session,source_label=excluded.source_label,status=excluded.status,stem_image_path=excluded.stem_image_path,explanation_image_path=excluded.explanation_image_path,updated_at=now();
 delete from public.question_options where question_id=q.id;
 n:=0;
 for o in select * from jsonb_array_elements(value->'options') loop
 oid:=gen_random_uuid(); insert into public.question_options(id,question_id,content,display_order) values(oid,q.id,o->>'content',n);
 if (o->>'correct')::boolean then insert into public.question_answer_keys(question_id,option_id) values(q.id,oid); end if; n:=n+1;
 end loop;
 return q.id;
end $$;
