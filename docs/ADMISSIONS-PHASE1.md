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
3. Set `ENQUIRY_TRUSTED_IP_HEADER` only when the ingress overwrites `cf-connecting-ip` or `x-real-ip` and direct-origin access is blocked. Otherwise rate limiting deliberately uses a shared 10-per-hour network bucket plus 3-per-hour per-phone bucket. No IP addresses are stored.
4. No verified hosted staging preview is available from this run. Local QA URL: http://127.0.0.1:3100 (disposable test data).
