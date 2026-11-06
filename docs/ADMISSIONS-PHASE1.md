# ALS admissions — Phase 1 delivery

Implemented on `feature/als-admissions-phase1-20261106`, based on `origin/main` (`01547ba`).

- Homepage keeps ALS branding and uses actual active programs, a hero enquiry form, course exploration, learning highlights and responsive navigation.
- Enquiry register/detail: search, status/course/date filters, pending follow-ups, ordering, pagination, assignment to existing active admins, notes, contact outcomes, follow-ups and history.
- Conversion reuses Student admission and its permanent Student Code generator. The enquiry lock, Auth/profile creation, enrollment and conversion link commit atomically. Duplicate conversion fails without an orphan account.
- Dashboard shows authorized database counts, recent admissions/enquiries and upcoming scheduled classes. Navigation groups existing URLs under Overview, Admissions and Academics.

Routes: `/`, `/admin`, `/admin/enquiries`, `/admin/enquiries/[id]`, existing `/admin/students` admission; APIs `/api/enquiries`, `/api/admin/enquiries`, `/api/admin/enquiries/[id]`, `/api/admin/enquiries/[id]/activities`, `/api/admin/dashboard`, existing `/api/admin/students`.

Migration: `supabase/migrations/20261106020602_admission_enquiries.sql`. Adds enquiries, immutable activity history, follow-ups, private rate/idempotency records, indexes, admin RLS, restricted RPCs and an additive extension of the existing Auth admission trigger.

## Verification

- `pnpm lint`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: 508 Vitest tests passed, 13 existing skips; 4 Node import regressions passed.
- `pnpm build`: passed.
- Fresh disposable localhost PostgreSQL 17 replay: all 63 migrations passed. Admissions SQL verified permissions, inactive-admin denial, deduplication, rate exhaustion, notes/contact/follow-up history, canonical admission/code generation and duplicate-conversion rollback. The existing batch-deletion regression passed at its migration boundary (its historical five-FK expectation predates three later history references).
- Browser: desktop 1440px, tablet 768px and mobile 390px homepage inspected; admin desktop/mobile register, detail, conversion and dashboard inspected. No horizontal overflow. Public/admin mobile navigation and keyboard Escape verified.
- Actual local HTTP/UI flow: homepage submit → persisted enquiry → admin search → notes/assignment/contact/follow-up/outcome → admission form → linked student/program/batch/permanent code → matching dashboard counts. Repeated submissions deduplicate. Invalid fields, missing consent, honeypot and invalid programs fail; actual rate exhaustion returns 429 with Retry-After. Unauthenticated and Teacher API access denied. No page JavaScript errors observed.

Local browser testing used real Next.js, PostgREST and PostgreSQL with disposable synthetic accounts and an Auth HTTP stand-in. Hosted Supabase GoTrue/provider behavior and a hosted staging rollout remain unverified. No production submissions, data changes, migration applications, secrets changes, merges or deployments were performed.

Repeat SQL verification against a disposable localhost cluster using `ALS_TEST_PSQL=<psql path> ALS_TEST_PGPORT=<local port> node scripts/admissions-local-qa.mjs`. The script creates a uniquely named database; it never reads hosted environment files.

## Before rollout

1. Review and apply the additive migration to a separately approved staging Supabase project, then run hosted Auth admission acceptance. Production migration application requires owner approval.
2. Configure the existing server-only `SUPABASE_SERVICE_ROLE_KEY`. Optional `ENQUIRY_RATE_LIMIT_SECRET` signs hashed rate identifiers (defaults to the service key).
3. Leave `ENQUIRY_TRUSTED_IP_HEADER` empty by default. Rate limiting uses a signed HttpOnly browser identity (10/hour) plus a durable phone quota (3/hour), so unrelated visitors never share a fallback bucket. Cookie clearing can reset browser fairness but cannot reset the phone quota. An optional canonical ingress header is accepted only when explicitly configured, valid, overwritten by the ingress and protected from direct-origin requests. No raw IP addresses are stored.
4. No verified hosted staging preview is available from this run. Local QA URL: http://127.0.0.1:3100 (disposable test data).

## PR review fixes — 6 November 2026

- Replaced the global unknown-IP quota with signed browser fairness and persistent phone limits; spoofed caller IP headers are ignored by default.
- Added narrow server-only program-picker grants after a real hosted check found `service_role` was denied program reads. Submission now uses a public invoker wrapper around a restricted private implementation.
- Hardened direct RPC JSON/type/null validation, canonical active-Admin permissions, activity fields and immutable history. Historical inactive assignees remain readable without blocking contact, reassignment or admission.
- Student creation checks the canonical admission handler and enabled Auth triggers before creating any identity. A verification transport failure after Auth success never deletes the student; the UI offers review instead of another Create.
- Tablet course links now fit a two-column grid. Consent and message errors are associated with their fields.
- Fresh localhost replay passes all 64 migrations and both admissions SQL suites, including real role grants, twelve independent browser/phone identities, durable phone limits across cookie resets, direct RPC denial, readiness drift, atomic conversion and existing batch-deletion regression.

Owner approved isolated staging `slghshcdaijbcjfoqerq` and branch-scoped Preview in Vercel `alslearning`. Chrome preflight verified Healthy project, organization, 68 migration-history rows, 61 applicable prerequisites, exact canonical admission-handler match, both Auth triggers enabled and no active live classes. The unrelated production-only live-cleanup grant is intentionally not applied to staging. Baseline counts: profiles 27, programs 6, batches 13, enrollments 26, live sessions 22.

Follow-up migration: `20261106030644_harden_enquiry_submission_and_rpc_validation.sql`. The restricted runner `scripts/admissions-staging-migrations.mjs` is read-only by default and refuses production or automatic prerequisite migration application. Hosted application and acceptance results will be recorded after verification.
