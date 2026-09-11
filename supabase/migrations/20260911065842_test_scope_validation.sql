-- Qualify the JSON item separately from the PL/pgSQL loop variable.
create or replace function private.validate_test_scopes(t public.tests)
returns void language plpgsql set search_path='' as $$
declare s jsonb; su uuid; chapters uuid[];
begin
 if not (coalesce(t.selection_rules,'{}') ? 'scopes') then return; end if;
 if t.subject_id is not null or t.chapter_id is not null or t.topic_id is not null
 or jsonb_typeof(t.selection_rules->'scopes') is distinct from 'array'
 or jsonb_array_length(t.selection_rules->'scopes')=0 then raise exception 'Invalid multiple-subject scope'; end if;
 if (select count(*)<>count(distinct item.value->>'subject_id') from jsonb_array_elements(t.selection_rules->'scopes') as item(value)) then raise exception 'Duplicate subject scope'; end if;
 for s in select * from jsonb_array_elements(t.selection_rules->'scopes') loop
  su:=(s->>'subject_id')::uuid;
  if su is null or not public.teacher_has_assignment(t.exam_id,t.program_id,su,'tests') then raise exception 'Subject scope permission denied'; end if;
  perform private.validate_taxonomy(t.exam_id,t.program_id,su,null,null);
  if jsonb_typeof(s->'chapter_ids') is distinct from 'array' then raise exception 'Invalid section scope'; end if;
  select array_agg(c::uuid) into chapters from jsonb_array_elements_text(s->'chapter_ids') c;
  if exists(select 1 from unnest(chapters) c where not exists(select 1 from public.chapters x where x.id=c and x.subject_id=su and (x.program_id is null or x.program_id=t.program_id))) then raise exception 'Section outside subject scope'; end if;
  if t.selection_mode='generated' and (coalesce(s->>'count','') !~ '^[1-9][0-9]*$') then raise exception 'Each subject needs a positive integer question count'; end if;
 end loop;
end $$;
revoke all on function private.validate_test_scopes(public.tests) from public,anon,authenticated;

