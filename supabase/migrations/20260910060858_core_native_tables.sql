-- Backward-compatible v2 ordered blocks in existing JSONB. No content rewrites.
create function private.rich_document_plain(doc jsonb, depth integer) returns text
language plpgsql immutable set search_path='' as $$
declare b jsonb; r jsonb; row_value jsonb; cell jsonb; result text:=''; part text;
 first_block boolean:=true; first_row boolean; first_cell boolean; columns_n integer;
 ri integer; ci integer; rr integer; cc integer; cs integer; rs integer; occupied jsonb;
begin
 if doc is null or doc='null'::jsonb then return null; end if;
 if depth>8 or jsonb_typeof(doc) is distinct from 'object' or doc->>'version' not in ('1','2') or jsonb_typeof(doc->'version') is distinct from 'number' or jsonb_typeof(doc->'blocks') is distinct from 'array' or (doc-'version'-'blocks')<>'{}'::jsonb then raise exception 'Invalid rich text document'; end if;
 for b in select * from jsonb_array_elements(doc->'blocks') loop
  if not first_block then result:=result||E'\n'; end if; first_block:=false;
  if jsonb_typeof(b) is distinct from 'object' then raise exception 'Invalid rich block'; end if;
  if b ? 'runs' then
   if (b-'runs')<>'{}'::jsonb or jsonb_typeof(b->'runs') is distinct from 'array' then raise exception 'Invalid paragraph'; end if;
   for r in select * from jsonb_array_elements(b->'runs') loop
    if jsonb_typeof(r) is distinct from 'object' or (r-'text'-'marks')<>'{}'::jsonb or jsonb_typeof(r->'text') is distinct from 'string' or jsonb_typeof(r->'marks') is distinct from 'array' then raise exception 'Invalid rich run'; end if;
    if exists(select 1 from jsonb_array_elements(r->'marks') m where jsonb_typeof(m)<>'string' or m#>>'{}' not in ('bold','italic','underline','superscript','subscript')) or ((r->'marks') ? 'superscript' and (r->'marks') ? 'subscript') or jsonb_array_length(r->'marks')<>(select count(distinct m) from jsonb_array_elements(r->'marks') m) then raise exception 'Invalid rich marks'; end if;
    result:=result||(r->>'text');
   end loop;
  elsif doc->>'version'='2' and b->>'type'='media' then
   if (b-'type'-'position')<>'{}'::jsonb or jsonb_typeof(b->'position') is distinct from 'number' or coalesce(b->>'position','')!~'^[0-9]+$' or (b->>'position')::numeric>2147483647 then raise exception 'Invalid media block'; end if;
  elsif doc->>'version'='2' and b->>'type'='table' then
   if (b-'type'-'columns'-'rows')<>'{}'::jsonb or jsonb_typeof(b->'columns') is distinct from 'number' or coalesce(b->>'columns','')!~'^[0-9]+$' or (b->>'columns')::numeric not between 1 and 100 or jsonb_typeof(b->'rows') is distinct from 'array' then raise exception 'Invalid table'; end if;
   if jsonb_array_length(b->'rows') not between 1 and 1000 then raise exception 'Invalid table size'; end if;
   columns_n:=(b->>'columns')::integer; occupied:='{}'; ri:=0; first_row:=true;
   for row_value in select * from jsonb_array_elements(b->'rows') loop
    if jsonb_typeof(row_value) is distinct from 'object' or (row_value-'cells')<>'{}'::jsonb or jsonb_typeof(row_value->'cells') is distinct from 'array' then raise exception 'Invalid table row'; end if;
    if not first_row then result:=result||E'\n'; end if; first_row:=false; ci:=0; first_cell:=true;
    for cell in select * from jsonb_array_elements(row_value->'cells') loop
     while occupied ? (ri||':'||ci) loop ci:=ci+1; end loop;
     if jsonb_typeof(cell) is distinct from 'object' or (cell-'content'-'colspan'-'rowspan'-'header')<>'{}'::jsonb or jsonb_typeof(cell->'header') is distinct from 'boolean' or jsonb_typeof(cell->'colspan') is distinct from 'number' or jsonb_typeof(cell->'rowspan') is distinct from 'number' or coalesce(cell->>'colspan','')!~'^[0-9]+$' or coalesce(cell->>'rowspan','')!~'^[0-9]+$' or (cell->>'colspan')::numeric not between 1 and 100 or (cell->>'rowspan')::numeric not between 1 and 1000 or jsonb_typeof(cell->'content') is distinct from 'object' then raise exception 'Invalid table cell'; end if;
     cs:=(cell->>'colspan')::integer; rs:=(cell->>'rowspan')::integer;
     if ci+cs>columns_n or ri+rs>jsonb_array_length(b->'rows') then raise exception 'Invalid table span'; end if;
     for rr in ri..ri+rs-1 loop for cc in ci..ci+cs-1 loop
      if occupied ? (rr||':'||cc) then raise exception 'Overlapping table cells'; end if;
      occupied:=occupied||jsonb_build_object(rr||':'||cc,true);
     end loop; end loop;
     part:=private.rich_document_plain(cell->'content',depth+1);
     if not first_cell then result:=result||E'\t'; end if; first_cell:=false;
     result:=result||part; ci:=ci+cs;
    end loop;
    for cc in 0..columns_n-1 loop if not(occupied ? (ri||':'||cc)) then raise exception 'Incomplete table row'; end if; end loop;
    ri:=ri+1;
   end loop;
  else raise exception 'Unsupported rich block'; end if;
 end loop;
 return result;
end $$;
revoke all on function private.rich_document_plain(jsonb,integer) from public,anon,authenticated;
create or replace function private.rich_plain(doc jsonb) returns text language sql immutable set search_path='' as $$
 select private.rich_document_plain(doc,0)
$$;

create function private.rich_media_positions(doc jsonb) returns integer[] language plpgsql immutable set search_path='' as $$
declare b jsonb; r jsonb; c jsonb; positions integer[]:='{}';
begin
 if doc is null or doc='null'::jsonb then return positions; end if;
 for b in select * from jsonb_array_elements(doc->'blocks') loop
  if b->>'type'='media' then positions:=array_append(positions,(b->>'position')::integer);
  elsif b->>'type'='table' then
   for r in select * from jsonb_array_elements(b->'rows') loop
    for c in select * from jsonb_array_elements(r->'cells') loop positions:=positions||private.rich_media_positions(c->'content'); end loop;
   end loop;
  end if;
 end loop;
 return positions;
end $$;
revoke all on function private.rich_media_positions(jsonb) from public,anon,authenticated;

-- Validate references after the canonical transaction has replaced media and options.
create function private.validate_rich_media() returns trigger language plpgsql security definer set search_path='' as $$
declare q public.questions; d jsonb; role_name text; positions integer[]; n integer;
begin
 select * into q from public.questions where id=new.id;
 if q.id is null then return null; end if;
 for role_name,d in select 'stem',q.prompt_rich union all select 'solution',q.explanation_rich loop
  perform private.rich_plain(d);
  positions:=private.rich_media_positions(d);
  if cardinality(positions)>0 then
   select count(*) into n from public.question_media where question_id=q.id and kind=role_name;
   if cardinality(positions)<>n or (select count(distinct p) from unnest(positions) p)<>n or exists(select 1 from unnest(positions) p where not exists(select 1 from public.question_media m where m.question_id=q.id and m.kind=role_name and m.position=p)) then raise exception 'Rich media references must match their question role exactly'; end if;
  end if;
 end loop;
 for d in select content_rich from public.question_options where question_id=q.id loop
  perform private.rich_plain(d);
  if cardinality(private.rich_media_positions(d))>0 then raise exception 'Option media is not supported'; end if;
 end loop;
 return null;
end $$;
revoke all on function private.validate_rich_media() from public,anon,authenticated;
create constraint trigger question_rich_media_valid after insert or update on public.questions
 deferrable initially deferred for each row execute function private.validate_rich_media();
