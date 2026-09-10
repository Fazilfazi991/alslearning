-- Forward-only source/display metadata and meaningful-stem validation. Existing columns and snapshots retained.
-- storage_path/mime_type remain the browser display asset. source.original is
-- the preserved source, and source.conversion describes the display derivation.
update storage.buckets set allowed_mime_types=array['image/png','image/jpeg','image/webp','image/gif','image/x-emf'] where id='question-media';
create function private.validate_media_derivative() returns trigger language plpgsql security definer set search_path='' as $$
declare original jsonb; conversion jsonb;
begin
 if new.source ? 'original' or new.source ? 'conversion' then
  original:=new.source->'original'; conversion:=new.source->'conversion';
  if jsonb_typeof(original) is distinct from 'object' or jsonb_typeof(conversion) is distinct from 'object'
    or coalesce(original->>'mime_type','')<>'image/x-emf'
    or coalesce(original->>'filename','')<>new.original_filename
    or coalesce(original->>'sha256','') !~ '^[a-f0-9]{64}$'
    or coalesce(conversion->>'display_sha256','') !~ '^[a-f0-9]{64}$'
    or coalesce(conversion->>'kind','')<>'windows-gdiplus-emf-docx-png-600dpi-white'
    or coalesce(conversion->>'version','')<>'1'
    or new.mime_type<>'image/png' or original->>'storage_path'=new.storage_path
    or jsonb_typeof(conversion->'width') is distinct from 'number' or jsonb_typeof(conversion->'height') is distinct from 'number'
    or coalesce((conversion->>'width')::integer,0)<1 or coalesce((conversion->>'height')::integer,0)<1
  then raise exception 'Invalid source/display media metadata'; end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='question-media'
    and o.name=original->>'storage_path' and o.metadata->>'mimetype'=original->>'mime_type'
    and (public.is_admin() or o.owner_id=auth.uid()::text or private.image_access(o.name)))
  then raise exception 'Original media unavailable or unauthorized'; end if;
 end if;
 return new;
end $$;
revoke all on function private.validate_media_derivative() from public,anon,authenticated;
create trigger question_media_derivative_valid before insert or update on public.question_media
 for each row execute function private.validate_media_derivative();
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
 if q.exam_id is null or q.subject_id is null then raise exception 'Exam and subject are required'; end if;
 if length(btrim(coalesce(q.prompt,'')))=0 and q.stem_image_path is null then raise exception 'Question requires text or stem media'; end if;
 q.prompt:=coalesce(q.prompt,'');
 if q.type='match_following' then raise exception 'Matching is disabled pending a dedicated pair editor and scorer'; end if;
 if q.marks<=0 or q.marks is null or q.negative_marks<0 or q.negative_marks is null then raise exception 'Invalid marks'; end if;
 select count(*),count(*) filter(where (x->>'correct')::boolean) into n,correct_n from jsonb_array_elements(value->'options') x;
 if n<2 or correct_n<1 or (q.type<>'multiple_mcq' and correct_n<>1) or exists(select 1 from jsonb_array_elements(value->'options') x where length(btrim(coalesce(x->>'content','')))=0) then raise exception 'Provide valid options and correct answers'; end if;
 if q.type='true_false' and (n<>2 or not ((value->'options') @> '[{"content":"True"},{"content":"False"}]'::jsonb)) then raise exception 'True/False requires True and False options'; end if;
 if q.type='image_mcq' and q.stem_image_path is null then raise exception 'An image is required'; end if;
 if q.stem_image_path is not null and not exists(select 1 from storage.objects where bucket_id='question-media' and name=q.stem_image_path and metadata->>'mimetype' in ('image/png','image/jpeg','image/webp','image/gif') and (public.is_admin() or owner_id=auth.uid()::text or private.image_access(name))) then raise exception 'Question image upload is missing'; end if;
 if q.explanation_image_path is not null and not exists(select 1 from storage.objects where bucket_id='question-media' and name=q.explanation_image_path and metadata->>'mimetype' in ('image/png','image/jpeg','image/webp','image/gif') and (public.is_admin() or owner_id=auth.uid()::text or private.image_access(name))) then raise exception 'Explanation image upload is missing'; end if;
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

create or replace function private.image_access(path text) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_admin() or (coalesce(private.active_role(),'')='teacher' and (split_part(path,'/',1)=auth.uid()::text or exists(select 1 from public.questions q where (q.stem_image_path=path or q.explanation_image_path=path or exists(select 1 from public.question_media m where m.question_id=q.id and (m.storage_path=path or m.source#>>'{original,storage_path}'=path))) and public.teacher_has_assignment(q.exam_id,q.program_id,q.subject_id,'questions'))))
 or (coalesce(private.active_role(),'')='student' and exists(select 1 from private.attempt_snapshots s join public.test_attempts a on a.id=s.attempt_id,jsonb_array_elements(s.questions) q where a.student_id=auth.uid() and private.attempt_access(a.test_id) and ((q->>'stem_image_path'=path or exists(select 1 from jsonb_array_elements(coalesce(q->'stem_media','[]')) m where (m->>'storage_path'=path or m#>>'{source,original,storage_path}'=path))) or (a.status<>'in_progress' and (s.review_settings->>'show_answers')::boolean and (s.review_settings->>'show_explanations')::boolean and (q->>'explanation_image_path'=path or exists(select 1 from jsonb_array_elements(coalesce(q->'solution_media','[]')) m where (m->>'storage_path'=path or m#>>'{source,original,storage_path}'=path)))))))
$$;
