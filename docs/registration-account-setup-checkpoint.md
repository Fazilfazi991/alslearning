# Registration account setup: checkpoint A

Baseline: origin/main `293edc6db8f8ffdbf0c491b3e9d460256c137245` on 10 November 2026. This is a local assessment; no shared environment was changed.

## Existing lifecycle

- Public submission stores a pending registration; approval creates an unconfirmed Auth identity with admission metadata. Database triggers perform admission and link the approved registration. The route verifies that link before sending an invitation.
- Existing students must prove ownership; their additional approved enrollment is marked `not_required` for invitation.
- Invitation attempts use `claim_registration_invitation` and `complete_registration_invitation`. Disabled delivery leaves admission intact. Local GoTrue evidence in `registration-auth-provider-qa.md` shows invitation reuses an unconfirmed identity; hosted behavior and receipt remain unverified.
- The callback verifies an invite or authorized recovery token, checks approved registration and active student profile, and issues a session-bound setup grant. The setup API checks the grant and password policy, sets the password and signs out.

## Gaps requiring coordinated changes

1. The callback verifies a single-use token on GET, so link scanners can consume it. Move verification behind deliberate user action while retaining identity binding and access checks.
2. A `sending` invitation is reclaimable after five minutes; a timeout may have been accepted by the provider. Unknown outcomes require reconciliation, not automatic retry. Explicit provider failure and unknown dispatch need distinct handling.
3. Setup completion is not durably represented; `sent` only records a successful provider response, not receipt or completed setup.
4. Hosted SMTP, sender, templates, redirect allowlist and flags are not verified here. Both known production hosts returned HTTP 200 without redirecting, so the canonical email origin remains unconfirmed.
5. The security candidate adds Auth/session safeguards that are not assumed deployed. Its compatibility with the callback, setup API and invitation RPC contracts must be reviewed by its owner before edits and release.

## Evidence and remaining acceptance

Existing `docs/evidence/student-registration/staging-nonemail-report.md` documents synthetic non-email staging approval, batch, code, capacity and duplicate checks, with explicit limitations, including an unexplained initial full-batch UI observation and a pending hosted Auth-orphan check for the second applicant. The targeted registration invitation, setup grant and admin registration tests passed locally (32 tests, 8 files) using mocks on 10 November 2026. They do not establish actual receipt, fresh-browser redemption, hosted security compatibility or course access.

A handoff was sent to the active security workstream for contract review and a named staging window, approved synthetic inbox and canonical domain. No production enablement or applicant mail is authorized by this checkpoint.

