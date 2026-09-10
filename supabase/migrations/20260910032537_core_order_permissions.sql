-- Program-wide ordering is an Admin operation; teacher editors do not expose it.
create or replace function public.core_move_content(target uuid,direction integer) returns void language plpgsql security definer set search_path='' as $$
declare c public.learning_content; other public.learning_content;
begin
 if not public.is_admin() or direction is null or direction not in (-1,1) or not private.content_access(target,true) then raise exception 'Content permission denied'; end if;
 select * into c from public.learning_content where id=target;
 perform pg_advisory_xact_lock(hashtextextended(c.program_id::text,1));
 -- Normalize legacy duplicate orders once under the same lock.
 with ordered as(select id,row_number() over(order by display_order,created_at,id)-1 as pos from public.learning_content where program_id=c.program_id) update public.learning_content x set display_order=o.pos from ordered o where x.id=o.id;
 select * into c from public.learning_content where id=target;
 select * into other from public.learning_content where program_id=c.program_id and display_order=c.display_order+direction;
 if other.id is not null then
 if not private.content_access(other.id,true) then raise exception 'Adjacent content belongs to another assignment'; end if;
 update public.learning_content set display_order=case when id=c.id then other.display_order else c.display_order end where id in (c.id,other.id);
 end if;
end $$;
