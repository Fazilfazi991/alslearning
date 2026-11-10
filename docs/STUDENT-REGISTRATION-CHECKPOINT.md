# Student registration: implementation checkpoint

This branch is incomplete and must not be deployed. It contains only shared validation for the proposed public application payload and unit tests. It does not provide `/register`, `/admin/registrations`, storage, approval, invitations, or account setup.

## Existing contracts that the implementation must preserve

- `/api/admin/students` creates an Auth user with privileged `lms_admission` application metadata. Database Auth triggers commit the profile, enrollment, code, and optional enquiry conversion together; the route checks admission readiness before creating an identity.
- That route currently sets `email_confirm: true` and requires an administrator-entered password. It therefore cannot be reused unchanged for an unverified self-service applicant.
- `/auth/callback` currently redirects to login without exchanging an email link or creating a recovery session. There is no existing student invitation/password-setup path.
- Batch capacity is enforced in the database with a row lock. Approval must preserve that guard and must not rely only on a preliminary count.
- The separate Teacher security work is modifying Auth/session controls and is using the same staging project. Registration changes must be reconciled with that work before any shared staging migration or release.

## Required design and verification before release

1. Create a private application store with bounded server-side validation, a service-only submission RPC, persistent rate limits and duplicate handling. Public submissions must not create Auth users or grant access.
2. Model approval as a durable, concurrency-safe state machine. The Auth admission transaction must atomically link the exact application and optional enquiry, and must never leave an approved application without a verified admission. Unknown Auth outcomes require reconciliation rather than a blind retry or deletion.
3. Verify a compatible unconfirmed-user and invitation/retry sequence against the deployed Auth triggers. Do not send an invite before the admission is committed; do not set `email_confirm` for an unverified address. Implement a safe callback and password setup, with a separate delivery state and recovery path.
4. Create secure, expiring, single-use registration links backed by hashed tokens. A link must not expose applicant information in the URL or grant access to other applications.
5. Implement authenticated active-admin review, least-privilege RLS, rejection, readiness checks, batch capacity and audit history; do not silently choose a default batch without an explicit reviewed default designation.
6. Exercise full browser, database, concurrency, invitation, login, authorization and negative tests in an isolated test environment and then coordinate an authorized staging window with the Teacher security work. Capture real evidence before any production deployment.

## Local tooling

The official Supabase CLI 3.1.0 archive was downloaded and checksum-verified, but Windows Application Control blocked execution of the CLI binary. No migration was generated or applied. A supported, permitted CLI installation or equivalent authorized environment is needed to create and test the migration under the project’s Supabase workflow.
