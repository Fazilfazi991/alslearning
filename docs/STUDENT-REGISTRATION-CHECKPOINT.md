# Student registration: draft integration checkpoint

This branch is incomplete and must not be merged or deployed. It now includes the public registration wizard, admin review and approval screens, server endpoints, account-setup flow, and a database prototype. The SQL in `docs/registration-schema-prototype.sql` is deliberately **not a migration** and has not been applied to staging. Without the schema, endpoints fail closed.

## Verified locally

- Public submission is designed to create only a pending application. Admin approval uses unconfirmed, passwordless Auth creation and the existing admission triggers; an additional prototype trigger atomically records approval only after enrollment and Student Code creation.
- A disposable PostgreSQL instance replayed all 64 existing migrations. Prototype SQL and a rolled-back fixture exercised submission deduplication, admin review, student-code creation, approval, invitation lease fencing, identity protection, and unauthorized application reads. This is not a real Supabase Auth or email test.
- Desktop and mobile screenshots in `docs/evidence/student-registration/` show the local form; they do not demonstrate persistence or account setup.

## Release blockers

1. Complete review of the registration SQL, identity guard, concurrent approval and capacity cases; generate and verify an actual migration through an authorized supported Supabase CLI environment. The locally downloaded Windows CLI was blocked by Windows Application Control.
2. Verify the real Supabase Auth invite, template, secure setup, email confirmation, login and authorized course access in an isolated environment. Invitations remain gated by `REGISTRATION_INVITATION_ENABLED`, `REGISTRATION_SITE_URL`, `REGISTRATION_SETUP_SECRET`, readiness checks and an appropriate allowlisted token-hash email template.
3. Implement and verify secure enquiry-linked registration links, a reliable ready-for-approval filter and any remaining field requirements. Review existing-identity handling and admission recovery; current behavior fails closed for conflicting identities.
4. Coordinate compatibility and a safe staging window with the parallel Teacher security work. Run staging browser and database acceptance, including concurrency, full batch and unauthorized access, before any release.

Do not treat unit tests, the SQL prototype or local screenshots as staging acceptance.
