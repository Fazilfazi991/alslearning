-- Whitespace-only rich projections do not count as meaningful question text.
-- Deferred validation observes the final transactional media replacement.
create function private.validate_meaningful_stem() returns trigger language plpgsql security definer set search_path='' as $$
declare q public.questions;
begin
 select * into q from public.questions where id=new.id;
 if q.id is null then return null; end if;
 if coalesce(q.prompt,'') !~ '[^[:space:]]' and not exists(
  select 1 from public.question_media m join storage.objects o on o.bucket_id='question-media' and o.name=m.storage_path
  where m.question_id=q.id and m.kind='stem' and m.mime_type in ('image/png','image/jpeg','image/webp','image/gif') and o.metadata->>'mimetype'=m.mime_type
 ) then raise exception 'Question requires meaningful text or valid stem media'; end if;
 return null;
end $$;
revoke all on function private.validate_meaningful_stem() from public,anon,authenticated;
create constraint trigger question_meaningful_stem after insert or update on public.questions
 deferrable initially deferred for each row execute function private.validate_meaningful_stem();
