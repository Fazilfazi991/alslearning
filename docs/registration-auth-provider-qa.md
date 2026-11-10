# Local registration Auth provider verification

Run from the repository root in PowerShell with Docker running:

```powershell
./scripts/registration-auth-provider-qa.ps1
```

The harness uses a separately named disposable Docker Compose project, loopback ports 19421 and 19425, and synthetic credentials and email addresses. It refuses to use pre-existing containers with the same name and tears down its own services afterward. It does not read production or staging configuration or send mail externally; Mailpit captures the message locally.

On 10 November 2026, the harness passed with Supabase GoTrue v2.197.0: an admin-created passwordless user remained unconfirmed, invitation reused the same user ID, Mailpit received the invite, invite token verification confirmed the email, setting a password and signing in succeeded, and a confirmed user's re-invitation was rejected.

This is a provider-only test. It does **not** establish that ALS admission triggers, approval state, capacity handling, the application's callback, its custom email template, or deployed Supabase settings work together. Those require separate isolated integration and authorized staging tests.
