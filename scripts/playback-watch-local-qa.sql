-- Run AFTER migration in a rollback-only transaction on the existing local ALS QA database.
insert into public.learning_content(id,slug,title,kind,program_id,status,external_url)
values('81000000-0000-0000-0000-000000000001','watch-rollback-probe','Synthetic rollback probe','video','20000000-0000-0000-0000-000000000001','active','https://example.invalid/synthetic.mp4');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000011',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$ declare n numeric; begin
 n:=public.record_playback_watch_interval('82000000-0000-0000-0000-000000000001','lesson','81000000-0000-0000-0000-000000000001',now()-interval '20 seconds',now()-interval '5 seconds',15);
 if n<>15 then raise exception 'Expected 15 actual seconds, got %',n; end if;
 n:=public.record_playback_watch_interval('82000000-0000-0000-0000-000000000001','lesson','81000000-0000-0000-0000-000000000001',now()-interval '20 seconds',now()-interval '5 seconds',15);
 if n<>15 or (select count(*) from public.playback_watch_events)<>1 then raise exception 'Retry inflated event count'; end if;
 n:=public.record_playback_watch_interval('82000000-0000-0000-0000-000000000002','lesson','81000000-0000-0000-0000-000000000001',now()-interval '15 seconds',now(),15);
 if n<>5 then raise exception 'Overlapping tab not deducted, got %',n; end if;
 begin
 perform public.record_playback_watch_interval('82000000-0000-0000-0000-000000000003','lesson','81000000-0000-0000-0000-000000000001',now()-interval '50 seconds',now(),50);
 raise exception 'Bound unexpectedly allowed';
 exception when others then if sqlerrm='Bound unexpectedly allowed' then raise; end if; end;
 perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
 begin
 perform public.record_playback_watch_interval('82000000-0000-0000-0000-000000000004','lesson','81000000-0000-0000-0000-000000000001',now()-interval '10 seconds',now(),10);
 raise exception 'Teacher unexpectedly allowed';
 exception when insufficient_privilege then null; end;
end $$;
select 'PASS bounded/retry/overlap/Teacher denial; rollback required' as result;

