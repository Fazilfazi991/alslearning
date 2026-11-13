# Registration setup credentials and current limits

This is the historical single-use checkpoint at registration commit `9f028d9`. The later local recovery candidate changes outcome recording and the test-only gate; see [registration-interrupted-setup.md](registration-interrupted-setup.md) for current behavior and outstanding limits. Hosted acceptance and release enablement remain open.

- The invitation email contains a one-time Supabase Auth token or token hash. The browser presents it to the application callback when the email template is configured to do so; Supabase Auth validates it on `verifyOtp`. Its lifetime follows the project's Email OTP setting. A link-following GET is not consumed by the draft callback, although form-submitting scanners may still consume it. Hosted template and configuration are unverified.
- The earlier application setup cookie was a signed, HttpOnly, Secure, SameSite Strict bearer value with no durable one-use record. The disabled draft replaces it with a random 256-bit bearer capability in the same cookie. Its SHA-256 digest, approved application, Student and verified session are stored in a private operation record. The database supplies the ten-minute expiry and claims the grant once. Clearing a browser cookie alone still does not invalidate copied credentials; the database claim blocks their use through the setup route.
- Successful invitation verification produces a Supabase access token and refresh token in the browser's Auth cookies through the SSR adapter. The callback buffers writes until application checks pass. Supabase validates the access token and manages refresh rotation and session termination; their actual hosted lifetimes and configuration are unverified. The application setup grant is separate from those credentials.
- The browser can present the application setup cookie and Supabase cookies automatically; HttpOnly prevents ordinary page JavaScript from reading them, but does not make a copied cookie or a compromised browser safe. No raw credentials are recorded in these notes.
- The application grant's expiry is separate from access-token expiry and the validity of the server-side Auth session. Signing out or deleting a browser cookie must not be assumed to revoke every copy or confirm remote revocation.

The registration invitation and password setup paths remain hard-disabled in the release candidate. Local integration and host settings must be verified before any enablement.

The draft records `issued`, `claimed`, `provider_confirmed`, `authorization_denied`, `unknown` and `superseded`. A killed process leaves `claimed`; an ambiguous provider response records `unknown` when possible, otherwise it remains `claimed`. Neither state automatically becomes reusable. New proof cannot create a replacement while a write may be outstanding. The resend availability check precedes email dispatch and is advisory; if it races with a claim, the issuance function still blocks a new grant. There is no reviewed durable reconciliation or reopening procedure yet, and `provider_confirmed` currently blocks reissuance even for legitimate recovery. An applicant must contact admissions; the system does not promise an immediately available replacement.

A Supabase Auth session remains distinct from the application capability. The one-use record does not invalidate Auth tokens or prevent an otherwise authorized direct Auth password change. The local route/database lab uses simulated Auth calls; real direct Auth behavior and complete fresh-device setup remain separate acceptance gates.
## Local integration checkpoint (draft)

The combined disposable fixture replays the registration migrations plus the shared candidate migrations into real local GoTrue v2.197.0/PostgreSQL, using Mailpit and PostgREST. The custom access-token hook was configured in the local container; independent proof of hook execution and hosted configuration remain open. One run exercised the actual callback and setup handlers from an empty simulated cookie jar, then performed real password login and queried the assigned enrollment and Student Code using the resulting Auth session. This is not a physical fresh browser/device test. The release guard was overridden only by the test.

The local resend reused the same unconfirmed identity and rejected the older invitation token before redeeming the new one; this does not establish hosted template behavior. The same local run observed that an authenticated active student could make the provider's normal direct password update. After setup signed out the invitation-created session, a direct Auth update with its old token returned 403 and protected enrollment access was denied both before and after that probe. Separately, after synthetic deactivation, a later login token's direct Auth update returned 403, a fresh login returned 400, and the database session guard denied access. This is evidence for that specific local GoTrue configuration, not a claim that application grant consumption revokes provider credentials or that hosted behavior matches.

No supported operator procedure currently turns an unresolved `claimed` or `unknown` operation into a safe, ordered recovery. Never automatically clear, retry or replace it. Admission staff should escalate the case; an operator must establish a separately reviewed reconciliation procedure before any replacement proof can be issued. Definitive provider failure is conservatively treated as unknown because the current integration does not prove whether a request was dispatched or applied. The local resend availability check is advisory and cannot prevent an email racing a claim; the issue function is the authoritative check that blocks a replacement grant while the write is unresolved.

## Reproduction commands

Use a fresh unique local suffix and free loopback port. The script refuses to reuse a named container or network and checks the security commit and migration drift. It retains the synthetic lab for independent review. Example:

```powershell
$env:ALS_REGISTRATION_LAB_SUFFIX='single-use-review'
$env:ALS_REGISTRATION_LAB_PORT='38134'
./scripts/registration-security-race-lab.ps1
```

Run the SQL adversarial checks against that named synthetic database after the route fixture has created its synthetic registration:

```powershell
Get-Content -LiteralPath supabase/tests/registration_setup_operations.sql -Raw |
  docker exec -i als-registration-race-single-use-review-pg psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -q
```

The real local GoTrue/Mailpit/PostgREST route fixture is separate and creates/tears down its own dedicated containers. It refuses to reuse an existing project:

```powershell
$env:ALS_COMBINED_AUTH_QA='1'
node scripts/run-registration-auth-integrated-qa.mjs
```

Both fixtures are local only. They use synthetic data and secrets; the Auth route test uses an empty simulated cookie jar and overrides the hard-disabled gate in tests, not in release code.

Definitive validation failures are rejected before a claim and no Auth write is dispatched. The draft does not yet classify provider errors as definitively safe failures: all returned or thrown update errors remain `unknown` (or `claimed` if result persistence fails). This is deliberately conservative and leaves recovery blocked pending an operator workflow and proof that a delayed request cannot race replacement.
