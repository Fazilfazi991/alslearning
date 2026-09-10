-- Backward-compatible v2 ordered blocks in existing JSONB. No content rewrites.
create or replace function private.rich_document_plain(doc jsonb, depth integer) returns text
language plpgsql immutable set search_path='' as $$
declare b jsonb; r jsonb; row_value jsonb; cell jsonb; result text:=''; part text;
 first_block boolean:=true; first_row boolean; first_cell boolean; columns_n integer;
 before_n integer; after_n integer; ri integer; ci integer; rr integer; cc integer; cs integer; rs integer; occupied jsonb;
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
    if jsonb_typeof(row_value) is distinct from 'object' or (row_value-'cells'-'before'-'after')<>'{}'::jsonb or jsonb_typeof(row_value->'cells') is distinct from 'array' then raise exception 'Invalid table row'; end if;
    before_n:=coalesce((row_value->>'before')::integer,0); after_n:=coalesce((row_value->>'after')::integer,0);
    if before_n<0 or after_n<0 or before_n+after_n>=columns_n or (row_value ? 'before' and (jsonb_typeof(row_value->'before')<>'number' or (row_value->>'before')!~'^[0-9]+$')) or (row_value ? 'after' and (jsonb_typeof(row_value->'after')<>'number' or (row_value->>'after')!~'^[0-9]+$')) then raise exception 'Invalid table grid offsets'; end if;
    for cc in 0..columns_n-1 loop if cc<before_n or cc>=columns_n-after_n then if occupied ? (ri||':'||cc) then raise exception 'Grid offset overlaps cell'; end if; occupied:=occupied||jsonb_build_object(ri||':'||cc,true); end if; end loop;
    if not first_row then result:=result||E'\n'; end if; first_row:=false; ci:=before_n; first_cell:=true;
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
