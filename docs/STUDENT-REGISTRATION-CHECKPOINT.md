# Student registration: release checkpoint

This feature is in draft PR #6 and is not yet ready for production. The public `/register` on the live site remains a design-only preview with submission disabled. The complete flow is implemented on this branch, including public registration, enquiry links, admin review and approval, new-student invitation and setup, and ownership-verified existing-student enrollment.

## Database and local verification

- Two additive registration migrations were generated with the official Supabase CLI in a dedicated hosted Linux runner. They have not been applied to shared staging or production.
- Local PostgreSQL checks cover RLS and admin-session compatibility with the Teacher security migrations in either order, identity proof, rejected or expired proof, full-batch rollback, duplicate applications and programs, and concurrent last-seat and same-application approvals.
- A fresh isolated GoTrue/Postgres integration replay verified pending applications without Auth accounts, atomic approval, Student Code and batch enrollment, invitation redemption and password login. It also verified an existing student can prove ownership and receive a second course without changing their code, creating another account or sending a second invitation.
- The existing-user path requires a verified signed-in identity. Matching an email in a public application alone is never sufficient.
- The full application tests, lint, typecheck and production build passed locally. Desktop and mobile screenshots in `docs/evidence/student-registration/` are design evidence, not staging acceptance.

## Remaining release blockers

1. The user explicitly requested registration and admin approval first, with email invitations later. The admin interface reports setup as deferred; newly approved students cannot set a password or sign in until links are sent. SMTP, token-hash templates, allowlisted callback, feature flags and secrets remain prerequisites for enabling invitations or recovery.
2. Teacher security reports it is not currently changing shared staging but cannot certify a registration test window; verify independent recovery and migration safeguards. Staging has six extra October 17 batch/live migrations and lacks one branch migration. It has no scheduled backups on its current plan. The registration branch has no confirmed staging-specific Supabase configuration. No staging schema or Auth settings have been changed.
3. Verify non-email browser submission and admin approval in a coordinated, recoverable staging environment, including unauthorized and concurrent cases. Before enabling invitations later, separately verify real invitation/recovery → Next.js callback → password setup → login → authorized course access.

Do not claim staging acceptance or enable production registration until the non-email staging checks pass.
