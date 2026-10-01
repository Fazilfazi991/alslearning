select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$ declare ex uuid; su uuid; q uuid; t uuid; a public.test_attempts; catalog jsonb; begin
 select exam_id into ex from public.programs where id='20000000-0000-0000-0000-000000000001';
 if ex is null then insert into public.entrance_exams(slug,name,status) values('hidden-score-rollback','Synthetic hidden score probe','active') returning id into ex;
 update public.programs set exam_id=ex where id='20000000-0000-0000-0000-000000000001'; end if;
 select subject_id into su from public.program_subjects where program_id='20000000-0000-0000-0000-000000000001' limit 1;
 if su is null then raise exception 'Local QA subject mapping missing'; end if;
 q:=public.core_save_question(jsonb_build_object('exam_id',ex,'program_id','20000000-0000-0000-0000-000000000001','subject_id',su,'type','single_mcq','prompt','Synthetic hidden score probe','difficulty','easy','marks',2,'negative_marks',0.5,'status','active','options','[{"content":"One","correct":true},{"content":"Two","correct":false}]'::jsonb));
 t:=public.core_save_test(jsonb_build_object('exam_id',ex,'program_id','20000000-0000-0000-0000-000000000001','subject_id',su,'title','Synthetic hidden score probe','type','subject','duration_minutes',10,'question_count',1,'default_negative_marks',0,'show_results',false,'show_answers',false,'show_explanations',false,'selection_mode','manual','status','active'),array[q],array[]::uuid[]);
 perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000011',true);
 a:=public.start_test_attempt(t);
 perform public.submit_test_attempt(a.id);
 select x into catalog from jsonb_array_elements(public.core_student_test_catalog()) x where x->>'id'=t::text;
 if catalog is null or catalog->'last_score'<>'null'::jsonb then raise exception 'Hidden score leaked through catalogue'; end if;
 if (select x->'score' from jsonb_array_elements(public.core_attempt_history(t)) x limit 1)<>'null'::jsonb then raise exception 'Hidden score leaked through history'; end if;
end $$;
select 'PASS canonical hidden-result submission remains hidden in catalogue and history; rollback required' as result;


