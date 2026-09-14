-- Keep every Exams security-definer RPC on an explicit authenticated-only ACL.
revoke all on function public.core_save_test(jsonb,uuid[],uuid[]) from public,anon,service_role;
revoke all on function public.start_test_attempt(uuid) from public,anon,service_role;
revoke all on function public.save_attempt_answer(uuid,uuid,uuid[]) from public,anon,service_role;
revoke all on function public.submit_test_attempt(uuid) from public,anon,service_role;
revoke all on function public.set_attempt_review_flag(uuid,uuid,boolean) from public,anon,service_role;
revoke all on function public.core_attempt_payload(uuid) from public,anon,service_role;
revoke all on function public.core_attempt_history(uuid) from public,anon,service_role;
revoke all on function public.core_test_summary(text) from public,anon,service_role;
revoke all on function public.core_student_test_catalog() from public,anon,service_role;
revoke all on function public.core_test_question_page(jsonb,integer,integer,text) from public,anon,service_role;
revoke all on function public.core_admin_test_results(uuid) from public,anon,service_role;
revoke all on function public.get_test_review(uuid) from public,anon,service_role;

grant execute on function public.core_save_test(jsonb,uuid[],uuid[]) to authenticated;
grant execute on function public.start_test_attempt(uuid) to authenticated;
grant execute on function public.save_attempt_answer(uuid,uuid,uuid[]) to authenticated;
grant execute on function public.submit_test_attempt(uuid) to authenticated;
grant execute on function public.set_attempt_review_flag(uuid,uuid,boolean) to authenticated;
grant execute on function public.core_attempt_payload(uuid) to authenticated;
grant execute on function public.core_attempt_history(uuid) to authenticated;
grant execute on function public.core_test_summary(text) to authenticated;
grant execute on function public.core_student_test_catalog() to authenticated;
grant execute on function public.core_test_question_page(jsonb,integer,integer,text) to authenticated;
grant execute on function public.core_admin_test_results(uuid) to authenticated;
grant execute on function public.get_test_review(uuid) to authenticated;
