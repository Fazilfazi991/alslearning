# ALS security function inventory

Captured from QA after `20260911020155_explicit_core_helper_function_grants.sql`. Production has no application functions; these are **QA actuals**, not claimed production results. The audit covers all 39 repository-defined functions and the separate platform event-trigger helper. All canonical owners are `postgres`; every canonical function has an empty `search_path`. No function bodies, modes, policies or owners changed.

## Five changed public helpers

| Function | Used by / caller | anon | authenticated | service_role | postgres | Mode | Returns | Volatility |
|---|---|---|---|---|---|---|---|---|
| `public.is_admin()` | Admin policies across academic tables, attempts and storage; access helper call chains | NO | YES | NO | YES | INVOKER | boolean | STABLE |
| `public.is_teacher()` | Private content/question media upload policies | NO | YES | NO | YES | INVOKER | boolean | STABLE |
| `public.has_program_access(uuid)` | Program, program-subject, chapter and topic policies; access/legacy RPCs | NO | YES | NO | YES | DEFINER | boolean | STABLE |
| `public.teacher_has_assignment(uuid, uuid, uuid, text)` | Question, content and test access; Teacher authoring/bank scope | NO | YES | NO | YES | DEFINER | boolean | STABLE |
| `public.can_join_live(uuid)` | Live messages/attachments policies; presence and hand-raise RPCs | NO | YES | NO | YES | INVOKER | boolean | STABLE |

## Six already-explicit authenticated private helpers

| Function | Used by / caller | anon | authenticated | service_role | postgres | Mode | Returns | Volatility |
|---|---|---|---|---|---|---|---|---|
| `private.active_role()` | Profile, batch, enrollment, subject, progress and media policies; role checks | NO | YES | NO | YES | DEFINER | text | STABLE |
| `private.enrolled(uuid, uuid)` | Batch policy; Student program/content/test/attempt eligibility | NO | YES | NO | YES | DEFINER | boolean | STABLE |
| `private.content_access(uuid, boolean)` | Content/batch/checkpoint/progress/storage policies and content authoring | NO | YES | NO | YES | DEFINER | boolean | STABLE |
| `private.test_access(uuid, boolean)` | Tests/test-question/test-batch policies; test bank and attempt RPCs | NO | YES | NO | YES | DEFINER | boolean | STABLE |
| `private.teacher_batches(uuid[])` | Content/test eligibility and transactional authoring RPCs | NO | YES | NO | YES | DEFINER | boolean | STABLE |
| `private.image_access(text)` | Private question-media storage SELECT policy | NO | YES | NO | YES | DEFINER | boolean | STABLE |

## Eleven owner-only internal helpers

| Function | Used by / caller | anon | authenticated | service_role | postgres | Mode | Returns | Volatility |
|---|---|---|---|---|---|---|---|---|
| `private.attempt_access(uuid)` | Permitted history/review/payload and image_access internal chain | NO | NO | NO | YES | DEFINER | boolean | STABLE |
| `private.handle_new_user()` | on_auth_user_created trigger | NO | NO | NO | YES | DEFINER | trigger | VOLATILE |
| `private.rich_document_plain(jsonb, integer)` | Canonical rich-text projection validation | NO | NO | NO | YES | INVOKER | text | IMMUTABLE |
| `private.rich_media_positions(jsonb)` | Rich/media validation and transactional authoring | NO | NO | NO | YES | INVOKER | integer[] | IMMUTABLE |
| `private.rich_plain(jsonb)` | Canonical plain-text projection validation | NO | NO | NO | YES | INVOKER | text | IMMUTABLE |
| `private.snapshot_questions(uuid[], numeric)` | start_test_attempt snapshot creation | NO | NO | NO | YES | DEFINER | jsonb | VOLATILE |
| `private.sync_profile_role()` | on_auth_user_role_updated trigger | NO | NO | NO | YES | DEFINER | trigger | VOLATILE |
| `private.validate_meaningful_stem()` | question_meaningful_stem deferred constraint trigger | NO | NO | NO | YES | DEFINER | trigger | VOLATILE |
| `private.validate_media_derivative()` | Media derivative constraint triggers | NO | NO | NO | YES | DEFINER | trigger | VOLATILE |
| `private.validate_rich_media()` | Rich/media constraint triggers | NO | NO | NO | YES | DEFINER | trigger | VOLATILE |
| `private.validate_taxonomy(uuid, uuid, uuid, uuid, uuid)` | Transactional question/content/test authoring | NO | NO | NO | YES | DEFINER | void | VOLATILE |

## Sixteen existing authenticated RPCs (unchanged grants)

| Function | Used by / caller | anon | authenticated | service_role | postgres | Mode | Returns | Volatility |
|---|---|---|---|---|---|---|---|---|
| `public.core_attempt_history(uuid)` | Authenticated application RPC; existing internal role/ownership guard remains authoritative | NO | YES | YES | YES | DEFINER | jsonb | STABLE |
| `public.core_attempt_payload(uuid)` | Authenticated application RPC; existing internal role/ownership guard remains authoritative | NO | YES | YES | YES | DEFINER | jsonb | VOLATILE |
| `public.core_move_content(uuid, integer)` | Authenticated application RPC; existing internal role/ownership guard remains authoritative | NO | YES | YES | YES | DEFINER | void | VOLATILE |
| `public.core_program_subjects(uuid, uuid[])` | Authenticated application RPC; existing internal role/ownership guard remains authoritative | NO | YES | YES | YES | DEFINER | void | VOLATILE |
| `public.core_save_content(jsonb, uuid[])` | Authenticated application RPC; existing internal role/ownership guard remains authoritative | NO | YES | YES | YES | DEFINER | uuid | VOLATILE |
| `public.core_save_question(jsonb)` | Authenticated application RPC; existing internal role/ownership guard remains authoritative | NO | YES | YES | YES | DEFINER | uuid | VOLATILE |
| `public.core_save_test(jsonb, uuid[], uuid[])` | Authenticated application RPC; existing internal role/ownership guard remains authoritative | NO | YES | YES | YES | DEFINER | uuid | VOLATILE |
| `public.core_test_bank()` | Authenticated application RPC; existing internal role/ownership guard remains authoritative | NO | YES | YES | YES | DEFINER | jsonb | STABLE |
| `public.core_test_summary(text)` | Authenticated application RPC; existing internal role/ownership guard remains authoritative | NO | YES | YES | YES | DEFINER | jsonb | STABLE |
| `public.finalize_expired_test_attempts(uuid)` | Authenticated application RPC; existing internal role/ownership guard remains authoritative | NO | YES | YES | YES | DEFINER | integer | VOLATILE |
| `public.get_test_review(uuid)` | Authenticated application RPC; existing internal role/ownership guard remains authoritative | NO | YES | YES | YES | DEFINER | jsonb | STABLE |
| `public.save_attempt_answer(uuid, uuid, uuid[])` | Authenticated application RPC; existing internal role/ownership guard remains authoritative | NO | YES | YES | YES | DEFINER | void | VOLATILE |
| `public.set_live_presence(uuid, boolean)` | Authenticated application RPC; existing internal role/ownership guard remains authoritative | NO | YES | YES | YES | DEFINER | live_participants | VOLATILE |
| `public.set_raised_hand(uuid, boolean)` | Authenticated application RPC; existing internal role/ownership guard remains authoritative | NO | YES | YES | YES | DEFINER | void | VOLATILE |
| `public.start_test_attempt(uuid)` | Authenticated application RPC; existing internal role/ownership guard remains authoritative | NO | YES | YES | YES | DEFINER | test_attempts | VOLATILE |
| `public.submit_test_attempt(uuid)` | Authenticated application RPC; existing internal role/ownership guard remains authoritative | NO | YES | YES | YES | DEFINER | numeric | VOLATILE |

## Retired checkpoint RPC (unchanged restriction)

| Function | Used by / caller | anon | authenticated | service_role | postgres | Mode | Returns | Volatility |
|---|---|---|---|---|---|---|---|---|
| `public.submit_checkpoint_response(uuid, uuid[])` | Authenticated application RPC; existing internal role/ownership guard remains authoritative | NO | NO | YES | YES | DEFINER | boolean | VOLATILE |

## Platform prerequisite

`public.rls_auto_enable()` is owned by postgres, SECURITY DEFINER, returns event_trigger, and has `search_path=pg_catalog` on QA. It is not created by any ALS migration. QA anon/authenticated execution is denied; service_role/postgres execution remains available. Migration 2 unconditionally references it. Production catalog lookup confirms it is absent. This platform difference blocks a faithful fresh replay before the new migration can run. No placeholder was installed in production.

## Grant provenance

The five public helpers had both PUBLIC EXECUTE and named anon/authenticated/service_role entries before the change. Catalog ACLs cannot identify the origin of each grant on their own. Repository inspection shows an explicit authenticated grant for `teacher_has_assignment(uuid,uuid,uuid,text)` in migration `20260905052130`; the other four rely on previous/default execution. The new migration restates all five authenticated grants and removes all five PUBLIC/anon/service_role grants. The six private authenticated helpers were already granted explicitly in `20260910024559`; their ACLs are unchanged. Internal-only helpers remain uncallable by API roles. No mutation RPC ACL changed.

## Dependency audit method

All migration SQL and all QA public/private function definitions, exact argument types, return types, ACLs, owners, volatility, search_path and policy expressions were inspected. Policy helper references were followed through invoker/definer call chains; trigger/validation helpers were distinguished from API-callable helpers. Empty search_path functions use schema-qualified application/auth references; PostgreSQL built-ins resolve through pg_catalog. The platform event-trigger function is the only non-ALS public/private function in this inventory.
