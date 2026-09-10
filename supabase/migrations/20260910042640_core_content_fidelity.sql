-- Forward-only: preserve legacy text, image references, and immutable attempt snapshots.
alter table public.questions add column prompt_rich jsonb, add column explanation_rich jsonb;
alter table public.question_options add column content_rich jsonb;
create table public.question_media (
 id uuid primary key default gen_random_uuid(),
 question_id uuid not null references public.questions(id) on delete cascade,
 kind text not null check(kind in ('stem','solution')),
 storage_path text not null check(length(storage_path)>0),
 mime_type text not null,
 original_filename text not null,
 position integer not null check(position>=0),
 source jsonb not null default '{}' check(jsonb_typeof(source)='object'),
 created_at timestamptz not null default now(),
 unique(question_id,kind,position)
);
alter table public.question_media enable row level security;
revoke all on public.question_media from public,anon,authenticated;
grant select on public.question_media to authenticated;
create policy question_media_staff_read on public.question_media for select to authenticated
 using(exists(select 1 from public.questions q where q.id=question_id));
-- Missing legacy storage objects stay represented; do not destroy prior data.
insert into public.question_media(question_id,kind,storage_path,mime_type,original_filename,position)
 select q.id,v.kind,v.path,coalesce(o.metadata->>'mimetype','application/octet-stream'),regexp_replace(v.path,'^.*/',''),0
 from public.questions q cross join lateral(values('stem',q.stem_image_path),('solution',q.explanation_image_path)) v(kind,path)
 left join storage.objects o on o.bucket_id='question-media' and o.name=v.path where v.path is not null;
update storage.buckets set allowed_mime_types=array['image/png','image/jpeg','image/webp','image/gif'] where id='question-media';

-- Allowlist AST, not HTML. Unknown keys and marks fail closed; text is rendered escaped.
create function private.rich_plain(doc jsonb) returns text language plpgsql immutable set search_path='' as $$
declare b jsonb; r jsonb; result text:=''; first_block boolean:=true;
begin
 if doc is null or doc='null'::jsonb then return null; end if;
 if jsonb_typeof(doc)<>'object' or doc->'version'<>'1'::jsonb or not(doc ? 'version') or jsonb_typeof(doc->'blocks') is distinct from 'array' or (doc-'version'-'blocks')<>'{}'::jsonb then raise exception 'Invalid rich text document'; end if;
 for b in select * from jsonb_array_elements(doc->'blocks') loop
  if jsonb_typeof(b)<>'object' or (b-'runs')<>'{}'::jsonb or jsonb_typeof(b->'runs') is distinct from 'array' then raise exception 'Invalid rich text block'; end if;
  if not first_block then result:=result||E'\n'; end if; first_block:=false;
  for r in select * from jsonb_array_elements(b->'runs') loop
   if jsonb_typeof(r)<>'object' or (r-'text'-'marks')<>'{}'::jsonb or jsonb_typeof(r->'text') is distinct from 'string' or jsonb_typeof(r->'marks') is distinct from 'array' then raise exception 'Invalid rich text run'; end if;
   if exists(select 1 from jsonb_array_elements(r->'marks') m where jsonb_typeof(m)<>'string' or m#>>'{}' not in ('bold','italic','underline','superscript','subscript')) or ((r->'marks') ? 'superscript' and (r->'marks') ? 'subscript') or jsonb_array_length(r->'marks')<>(select count(distinct m) from jsonb_array_elements(r->'marks') m) then raise exception 'Invalid rich text marks'; end if;
   result:=result||(r->>'text');
  end loop;
 end loop;
 return result;
end $$;
revoke all on function private.rich_plain(jsonb) from public,anon,authenticated;

create or replace function public.core_save_question(value jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare q public.questions; old public.questions; o jsonb; oid uuid; n integer; correct_n integer; m jsonb; mid uuid; opts jsonb:='[]'; doc jsonb; projected text;
begin
 -- Serialize edits, including first creation with a caller supplied deterministic ID.
 value:=jsonb_set(value,'{id}',to_jsonb(coalesce((value->>'id')::uuid,gen_random_uuid())));
 perform pg_advisory_xact_lock(hashtextextended(value->>'id',17));
 if value ? 'media' then
  if jsonb_typeof(value->'media') is distinct from 'array' then raise exception 'Invalid media list'; end if;
  value:=jsonb_set(jsonb_set(value,'{stem_image_path}',coalesce((select to_jsonb(x->>'storage_path') from jsonb_array_elements(value->'media') x where x->>'kind'='stem' order by (x->>'position')::integer limit 1),'null')),'{explanation_image_path}',coalesce((select to_jsonb(x->>'storage_path') from jsonb_array_elements(value->'media') x where x->>'kind'='solution' order by (x->>'position')::integer limit 1),'null'));
 end if;
 q:=jsonb_populate_record(null::public.questions,value); q.id:=coalesce(q.id,gen_random_uuid());
 select * into old from public.questions where id=q.id for update;
 if not public.teacher_has_assignment(q.exam_id,q.program_id,q.subject_id,'questions') or (old.id is not null and not public.teacher_has_assignment(old.exam_id,old.program_id,old.subject_id,'questions')) then raise exception 'Question permission denied'; end if;
 -- Omitted rich fields on unchanged legacy payloads retain formatting.
 if not(value ? 'prompt_rich') and q.prompt is not distinct from old.prompt then q.prompt_rich:=old.prompt_rich; end if;
 if not(value ? 'explanation_rich') and q.explanation is not distinct from old.explanation then q.explanation_rich:=old.explanation_rich; end if;
 projected:=private.rich_plain(q.prompt_rich);
 if projected is not null then q.prompt:=projected; end if;
 projected:=private.rich_plain(q.explanation_rich);
 if projected is not null then q.explanation:=projected; end if;
 n:=0;
 for o in select * from jsonb_array_elements(value->'options') loop
  doc:=o->'content_rich';
  if not(o ? 'content_rich') then select content_rich into doc from public.question_options where question_id=q.id and display_order=n and content=o->>'content'; end if;
  projected:=private.rich_plain(doc);
  o:=o||jsonb_build_object('content_rich',doc);
  if projected is not null then o:=o||jsonb_build_object('content',projected); end if;
  opts:=opts||jsonb_build_array(o); n:=n+1;
 end loop;
 value:=jsonb_set(value,'{options}',opts);
 perform private.validate_taxonomy(q.exam_id,q.program_id,q.subject_id,q.chapter_id,q.topic_id);
 if q.exam_id is null or q.subject_id is null or length(btrim(coalesce(q.prompt,'')))=0 then raise exception 'Exam, subject and question text are required'; end if;
 if q.type='match_following' then raise exception 'Matching is disabled pending a dedicated pair editor and scorer'; end if;
 if q.marks<=0 or q.marks is null or q.negative_marks<0 or q.negative_marks is null then raise exception 'Invalid marks'; end if;
 select count(*),count(*) filter(where (x->>'correct')::boolean) into n,correct_n from jsonb_array_elements(value->'options') x;
 if n<2 or correct_n<1 or (q.type<>'multiple_mcq' and correct_n<>1) or exists(select 1 from jsonb_array_elements(value->'options') x where length(btrim(coalesce(x->>'content','')))=0) then raise exception 'Provide valid options and correct answers'; end if;
 if q.type='true_false' and (n<>2 or not ((value->'options') @> '[{"content":"True"},{"content":"False"}]'::jsonb)) then raise exception 'True/False requires True and False options'; end if;
 if q.type='image_mcq' and q.stem_image_path is null then raise exception 'An image is required'; end if;
 if q.stem_image_path is not null and not exists(select 1 from storage.objects where bucket_id='question-media' and name=q.stem_image_path) then raise exception 'Question image upload is missing'; end if;
 if q.explanation_image_path is not null and not exists(select 1 from storage.objects where bucket_id='question-media' and name=q.explanation_image_path) then raise exception 'Explanation image upload is missing'; end if;
 insert into public.questions(id,exam_id,program_id,subject_id,chapter_id,topic_id,type,prompt,explanation,difficulty,marks,negative_marks,source_type,source_reference,exam_year,exam_session,source_label,status,stem_image_path,explanation_image_path,prompt_rich,explanation_rich)
 values(q.id,q.exam_id,q.program_id,q.subject_id,q.chapter_id,q.topic_id,q.type,q.prompt,q.explanation,q.difficulty,q.marks,q.negative_marks,coalesce(q.source_type,'standard'),q.source_reference,q.exam_year,q.exam_session,q.source_label,coalesce(q.status,'draft'),q.stem_image_path,q.explanation_image_path,q.prompt_rich,q.explanation_rich)
 on conflict(id) do update set exam_id=excluded.exam_id,program_id=excluded.program_id,subject_id=excluded.subject_id,chapter_id=excluded.chapter_id,topic_id=excluded.topic_id,type=excluded.type,prompt=excluded.prompt,explanation=excluded.explanation,difficulty=excluded.difficulty,marks=excluded.marks,negative_marks=excluded.negative_marks,source_type=excluded.source_type,source_reference=excluded.source_reference,exam_year=excluded.exam_year,exam_session=excluded.exam_session,source_label=excluded.source_label,status=excluded.status,stem_image_path=excluded.stem_image_path,explanation_image_path=excluded.explanation_image_path,prompt_rich=excluded.prompt_rich,explanation_rich=excluded.explanation_rich,updated_at=now();
 delete from public.question_options where question_id=q.id;
 n:=0;
 for o in select * from jsonb_array_elements(value->'options') loop
 oid:=gen_random_uuid(); insert into public.question_options(id,question_id,content,display_order,content_rich) values(oid,q.id,o->>'content',n,o->'content_rich');
 if (o->>'correct')::boolean then insert into public.question_answer_keys(question_id,option_id) values(q.id,oid); end if; n:=n+1;
 end loop;
 if value ? 'media' then
  -- Entire relation replacement is atomic; storage bytes are never deleted here.
  for m in select * from jsonb_array_elements(value->'media') loop
   if jsonb_typeof(m)<>'object' or m->>'mime_type' not in ('image/png','image/jpeg','image/webp','image/gif') then raise exception 'Unsupported media'; end if;
   if not exists(select 1 from storage.objects o where o.bucket_id='question-media' and o.name=m->>'storage_path' and o.metadata->>'mimetype'=m->>'mime_type' and (public.is_admin() or o.owner_id=auth.uid()::text or private.image_access(o.name))) then raise exception 'Media upload unavailable or unauthorized'; end if;
  end loop;
  delete from public.question_media where question_id=q.id;
  for m in select * from jsonb_array_elements(value->'media') loop
   mid:=coalesce((m->>'id')::uuid,gen_random_uuid());
   insert into public.question_media(id,question_id,kind,storage_path,mime_type,original_filename,position,source)
    values(mid,q.id,m->>'kind',m->>'storage_path',m->>'mime_type',m->>'original_filename',(m->>'position')::integer,coalesce(m->'source','{}'));
  end loop;
  if exists(select 1 from public.question_media where question_id=q.id group by kind having min(position)<>0 or max(position)<>count(*)-1) then raise exception 'Media order must be contiguous'; end if;
 elsif old.id is null or q.stem_image_path is distinct from old.stem_image_path or q.explanation_image_path is distinct from old.explanation_image_path then
  -- Legacy single-image client: update only the changed role, retaining other galleries.
  for m in select jsonb_build_object('kind',kind,'path',path) from (values('stem',q.stem_image_path,old.stem_image_path),('solution',q.explanation_image_path,old.explanation_image_path)) v(kind,path,prior) where old.id is null or path is distinct from prior loop
   delete from public.question_media where question_id=q.id and kind=m->>'kind';
   if m->>'path' is not null then insert into public.question_media(question_id,kind,storage_path,mime_type,original_filename,position) select q.id,m->>'kind',o.name,coalesce(o.metadata->>'mimetype','application/octet-stream'),regexp_replace(o.name,'^.*/',''),0 from storage.objects o where o.bucket_id='question-media' and o.name=m->>'path'; end if;
  end loop;
 end if;
 return q.id;
end $$;

create or replace function private.snapshot_questions(ids uuid[],negative numeric) returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'prompt',q.prompt,'prompt_rich',q.prompt_rich,'explanation_rich',q.explanation_rich,
 'stem_media',(select coalesce(jsonb_agg(to_jsonb(m) order by m.position),'[]') from public.question_media m where m.question_id=q.id and m.kind='stem'),
 'solution_media',(select coalesce(jsonb_agg(to_jsonb(m) order by m.position),'[]') from public.question_media m where m.question_id=q.id and m.kind='solution'),'type',q.type,'marks',q.marks,'negative_marks',negative,'stem_image_path',q.stem_image_path,'explanation',q.explanation,'explanation_image_path',q.explanation_image_path,
 'options',(select jsonb_agg(jsonb_build_object('id',o.id,'content',o.content,'content_rich',o.content_rich) order by o.display_order) from public.question_options o where o.question_id=q.id),
 'correct_ids',(select jsonb_agg(k.option_id order by k.option_id) from public.question_answer_keys k where k.question_id=q.id)) order by array_position(ids,q.id)),'[]') from public.questions q where q.id=any(ids)
$$;

create or replace function public.core_attempt_payload(target_attempt uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.test_attempts; s private.attempt_snapshots;
begin
 select * into a from public.test_attempts where id=target_attempt and student_id=auth.uid();
 if coalesce(private.active_role(),'') is distinct from 'student' or a.id is null or not private.test_access(a.test_id) then raise exception 'Attempt access denied'; end if;
 if a.status='in_progress' and a.expires_at<=now() then perform public.submit_test_attempt(a.id); select * into a from public.test_attempts where id=a.id; end if;
 select * into s from private.attempt_snapshots where attempt_id=a.id;
 return jsonb_build_object('id',a.id,'status',a.status,'expires_at',a.expires_at,'option_order',a.option_order,'questions',case when a.status='in_progress' then (select jsonb_agg(q-'correct_ids'-'explanation'-'explanation_image_path'-'explanation_rich'-'solution_media') from jsonb_array_elements(s.questions) q) else '[]'::jsonb end,'answers',(select coalesce(jsonb_object_agg(question_id,selected_option_ids),'{}') from public.attempt_answers where attempt_id=a.id));
end $$;

create or replace function public.get_test_review(target_attempt uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('status',a.status,'results_visible',(s.review_settings->>'show_results')::boolean,'score',case when (s.review_settings->>'show_results')::boolean then a.score end,'total_marks',s.total_marks,'answers',case when (s.review_settings->>'show_answers')::boolean then (select jsonb_agg(jsonb_build_object('question_id',q->>'id','prompt',q->>'prompt','prompt_rich',q->'prompt_rich','stem_media',q->'stem_media','solution_media',case when (s.review_settings->>'show_explanations')::boolean then q->'solution_media' end,'explanation_rich',case when (s.review_settings->>'show_explanations')::boolean then q->'explanation_rich' end,'options',q->'options','stem_image_path',q->>'stem_image_path','selected_option_ids',coalesce(to_jsonb(aa.selected_option_ids),'[]'),'correct_option_ids',q->'correct_ids','marks_awarded',coalesce(aa.marks_awarded,0),'explanation',case when (s.review_settings->>'show_explanations')::boolean then q->>'explanation' end,'explanation_image_path',case when (s.review_settings->>'show_explanations')::boolean then q->>'explanation_image_path' end)) from jsonb_array_elements(s.questions) q left join public.attempt_answers aa on aa.attempt_id=a.id and aa.question_id=(q->>'id')::uuid) else '[]'::jsonb end)
 from public.test_attempts a join private.attempt_snapshots s on s.attempt_id=a.id where a.id=target_attempt and a.student_id=auth.uid() and coalesce(private.active_role(),'')='student' and a.status<>'in_progress' and private.attempt_access(a.test_id)
$$;

create or replace function private.image_access(path text) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_admin() or (coalesce(private.active_role(),'')='teacher' and (split_part(path,'/',1)=auth.uid()::text or exists(select 1 from public.questions q where (q.stem_image_path=path or q.explanation_image_path=path or exists(select 1 from public.question_media m where m.question_id=q.id and m.storage_path=path)) and public.teacher_has_assignment(q.exam_id,q.program_id,q.subject_id,'questions'))))
 or (coalesce(private.active_role(),'')='student' and exists(select 1 from private.attempt_snapshots s join public.test_attempts a on a.id=s.attempt_id,jsonb_array_elements(s.questions) q where a.student_id=auth.uid() and private.attempt_access(a.test_id) and ((q->>'stem_image_path'=path or exists(select 1 from jsonb_array_elements(coalesce(q->'stem_media','[]')) m where m->>'storage_path'=path)) or (a.status<>'in_progress' and (s.review_settings->>'show_answers')::boolean and (s.review_settings->>'show_explanations')::boolean and (q->>'explanation_image_path'=path or exists(select 1 from jsonb_array_elements(coalesce(q->'solution_media','[]')) m where m->>'storage_path'=path))))))
$$;
