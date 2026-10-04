# Native classroom hardening acceptance — 24 September 2026

Scope: branch `codex/cloudflare-native-classroom`, based on `1f0c60e98c4186638bc7b037c55db7dfed5ff456`. Production, hosted Supabase data, Cloudflare resources, production flags, deployments, and remotes were not changed.

## Executed evidence

| Check | Environment and command/steps | Actual result | Verdict |
|---|---|---|---|
| Fresh migration replay | Disposable project `als_live_class_qa_20260924`, loopback ports 55320–55329; `pnpm dlx supabase@2.117.0 db reset --local --no-seed` | All 38 migrations applied. `20260924085900`, `20260924090000`, and `20260924090100` executed as separate migration transactions in that order. | PASS |
| Pre-classroom upgrade | Same disposable stack reset to `20260915164105`, synthetic rows inserted, then `migration up --local` | Both original classroom migrations and the hardening migration applied; existing session and recording rows survived. Recording owner was backfilled before `NOT NULL`. | PASS |
| Auth/RLS/RPC | `node scripts/live-class-local-fixtures.mjs`, then `node scripts/live-class-local-security-qa.mjs` with loopback-only variables | 10 synthetic Auth users; 23 assertions passed across Admin, assigned/unassigned Teachers, eligible/suspended/inactive Students, forged writes, poll options, recording visibility, removal, and transport cleanup candidacy. | PASS |
| Supabase Realtime | `node scripts/live-class-local-realtime-qa.mjs` | Eligible Student and assigned Teacher subscribed; suspended Student got `CHANNEL_ERROR`; RLS-protected message delivery was 1 before removal and 0 after removal; fresh rejoin was denied. Cached established-channel Broadcast reception remained 1, as documented below. | PASS with bounded Broadcast caveat |
| Protected UI, desktop | Chrome, local Next.js, real local Auth sessions; `/admin/live-classes` and `/live-poc/600…001` | Admin, assigned Teacher, and eligible Student views rendered their correct role controls. Missing provider variables were shown honestly and join was disabled. Browser console had no warnings/errors. | PASS |
| Protected UI, mobile simulation | Same Student at explicit 390×844 viewport | Found a 391 px stage in a 375 px layout; fixed responsive minimum height. Recheck: document `clientWidth=375`, `scrollWidth=375`, stage `374.67`. | PASS (browser simulation, not a physical phone) |
| Request payload | `node scripts/live-class-local-request-volume-qa.mjs`, 200 synthetic messages, authenticated Student | Old unbounded RPC: 200 rows / 53,201 JSON bytes. New page: 50 rows / 13,301 bytes, maximum 100. Rows were deleted after measurement. | PASS |
| Static/unit/build | `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm build`; `git diff --check` | Lint and typecheck clean; 36 Vitest files / 239 tests and 4 Node tests passed; production build succeeded; diff check clean. | PASS |

The disposable stack is reproducible and refuses non-loopback/non-55321 targets in all three QA scripts. Its Docker namespace and volumes are distinct from the pre-existing local Supabase project.

## Bugs found and fixed

1. Valid Student poll responses were rejected because an RLS policy attempted to read answer-sensitive `question_options` as the Student. A narrow `SECURITY DEFINER` predicate now validates exactly one option, an open poll, the matching question, and current class eligibility.
2. None of the five subscribed classroom tables was in `supabase_realtime`; the event handlers could never fire. The hardening migration adds them idempotently.
3. The 8-second transport fallback was the effective update path. Track changes are now event-driven and coalesced, with one in-flight refresh, a 60-second jittered consistency check, and failure backoff to five minutes.
4. Chat bootstrapping returned the entire history. It now uses stable `(created_at,id)` keyset pagination (50 initially, 100 maximum) and incremental fetches.
5. Browser telemetry uploaded every 30 seconds. It now uploads every 60 seconds while keeping local two-second display sampling.
6. Provider close handling treated missing or incomplete per-track results as success. It now matches mids, honors every per-track error, inspects uncertain/duplicate close results, persists failures, and retries with bounded backoff.
7. Class end only closed publications. It now reconciles publications and subscriber mids. Revocation/removal failures remain retryable.
8. Eligibility changes during an active class had no invoked provider cleanup. An authorized manager now invokes reconciliation immediately and every 30 seconds; stale, removed, inactive, unenrolled, or unassigned connections are candidates. Database authorization still blocks new operations immediately.
9. A class manager could not update subscription cleanup state under RLS. The update policy now explicitly permits the Admin or assigned Teacher.
10. A Teacher's `validated: true` promoted recordings to verified/ready. Client playback is now only evidence; Admin review rechecks object existence and exact size before setting `verified_at`, and publication remains a separate action.
11. The only IndexedDB recovery copy was deleted immediately after client validation. It is now retained until publication.
12. Historical recordings could have a null owner. The migration backfills the assigned Teacher then enforces `NOT NULL`.
13. The mobile 16:9 stage overflowed because 220 px minimum height implied a 391 px width. Mobile minimum is now 200 px, with 220 px retained from `sm` upward.

## Request and query audit

Fixed client-originated baseline while connected:

| Activity | Before | After |
|---|---:|---:|
| Track consistency GET | 7.5/minute (8-second timer) | about 1/minute nominal, jittered; exponential failure backoff to 0.2/minute |
| Attendance heartbeat | 4/minute | 4/minute |
| Diagnostic upload | 2/minute | 1/minute |
| Total fixed baseline | 13.5 requests/participant/minute | about 6 requests/participant/minute |

At 50 Students × 40 hours, that is approximately 1,620,000 fixed application requests before and 720,000 after, a 55.6% reduction. Track refresh cycles alone fall from the reference 900,000 to about 120,000 (86.7%). These are application-request counts, not Cloudflare or Supabase billing units.

Realtime adds change-driven requests: chat is one incremental RPC after a 150 ms coalescing window; poll is one RPC; Student participant refresh is one query; manager participant refresh is attendance refresh + roster + own participant; track events share one in-flight discovery/subscribe queue. Heartbeats are not broadcast.

The discovery GET performs Auth lookup, profile/session authorization, role-specific assignment or enrollment verification, and the active-track query (five backend operations in the current route). Heartbeat and stats POSTs add owned-connection lookup plus their RPC/insert. Empty discovery response is a constant `{"tracks":[]}`; non-empty responses grow only with active publications. Initial messages are bounded; roster and poll payloads grow with class size and active poll options respectively.

## Revocation boundaries

- New joins, publishes, subscribes, heartbeats, messages, and state reads are server/RLS authorized each time.
- Microphone revocation closes only the Student microphone mid; presenter revocation closes only the screen mid. Grants are independent.
- Removal closes only the target Student's publications and subscriptions, then closes that connection and prevents new operations. It does not close the Teacher publication for other receivers.
- Class end closes all tracked publication/subscription mids, closes connections and attendance, and rejects new media operations. The assigned recording owner may still complete an existing upload.
- Eligibility/profile/assignment invalidation is detected by the manager reconciliation loop within its 30-second cadence; new database/media operations fail earlier at their next authorization check.
- Supabase Postgres Changes apply table RLS per delivered row: the removed Student received zero subsequent chat rows in the executed test. Supabase private Broadcast/Presence authorization is cached for an established WebSocket. The removed test client still received one arbitrary Broadcast until reconnect/token expiry, but could not freshly join. ALS sends classroom state through Postgres Changes and does not register Broadcast handlers. A malicious client may retain arbitrary private-topic Broadcast reception for that bounded established-socket window; no sensitive ALS state should be placed in Broadcast/Presence.

Real media-stop timing is not claimed: no approved SFU application existed, so a hostile open transport could not be exercised against Cloudflare.

## Recording audit and repeatable two-hour soak

Code evidence: one `MediaRecorder` feeds one ordered assembler; non-final parts must be exactly 8 MiB, final part may be smaller; part numbers must be contiguous; database SHA/length/ETag evidence must match R2 `ListParts`; expired URLs are re-signed per upload attempt; completion is idempotently recovered through the unique object; a Web Lock prevents same-browser two-tab capture ownership; separately restarted captures create ordered segments; capture interruption and upload interruption use distinct persisted states. The composite contains only the selected teaching visual plus the Teacher microphone. Remote Student audio is never added. The UI warns against sharing the classroom/private display.

Real R2 decoding, duration, seeking, renewal, interrupted upload, tab recovery, post-end completion, separate-Student playback, and unpublished denial remain blocked because the existing QA bucket was not authorized for this POC and its token/CORS scope was not verified. No mock is counted as acceptance.

Repeatable soak procedure (not yet run):

1. Record start timestamp, browser/OS, free IndexedDB quota, process memory, network, class/recording/segment IDs, and R2 baseline.
2. Start Teacher composite at 900 kbps video + 64 kbps audio. Log every 10 minutes: wall time, encoded bytes, local stored bytes, acknowledged parts, R2 listed parts, upload backlog, heap/process memory, connection state, and background/foreground state.
3. At 00:20 and 01:20 switch slide/motion source; at 00:40 background for 10 minutes; at 01:00 interrupt one part and require re-sign/resume; at 01:40 end the class while upload remains pending; at 01:50 close/reopen the Teacher tab and recover persisted data.
4. At 02:00 stop capture, reconcile, complete, play every segment, seek early/middle/near-end, force URL renewal while preserving position, complete Admin review, publish, and verify in a separate Student context with no Teacher IndexedDB.
5. Record max backlog, memory delta, local/R2 bytes, duration delta, failures/retries, and media inspection. Mark PASS only if two wall-clock hours elapsed and all checks pass.

## Read-only external discovery

- Cloudflare account: `Academyforlaboratoryscience@gmail.com's Account`, account ID `c595e85a425e3e575b97d71c994f2e69`.
- R2 currently contains `als-recorded-classes-production` and `als-recorded-classes-qa`; each showed 12 objects / 1.78 GB. Current account view showed $0.00 billable usage and 3.56 GB total storage. Existing local variable names include legacy recorded-class R2 credentials and `R2_BUCKET_NAME`, but the native classroom intentionally requires separate approved `R2_BUCKET`; credential validity/scope was not assumed.
- Serverless SFU and TURN both showed the Realtime “Get Started” activation surface, not an application/key list. The surface stated free usage includes 1,000 GB/month. Activation was not clicked, so any payment-method or usage-billing requirement remains unconfirmed.
- Supabase organization has active `ALS Production` and an unidentified paused project. Neither is an approved staging target; neither was opened or changed. Local testing did not need a new hosted project.

Consolidated approval needed for real-provider acceptance:

1. Authorize activation in Cloudflare account `c595…f2e69` and creation of isolated SFU app `als-live-poc-sfu` plus separate TURN key `als-live-poc-turn`. Confirm acceptance of any usage-billing/payment step shown after “Get Started”; no such step has been accepted.
2. Authorize either reuse of private bucket `als-recorded-classes-qa` for this POC or creation of `als-live-poc-recordings` (R2 Standard), plus a bucket-scoped read/write credential and CORS limited to the approved local/staging origin. Do not reuse production bucket credentials.
3. For physical-device/cross-network testing only, identify and approve a secured hosted staging environment. Do not use `ALS Production` or the unnamed paused project by inference.
4. Place secrets only in ignored local/staging secret storage as `CF_REALTIME_APP_ID`, `CF_REALTIME_APP_SECRET`, `CF_TURN_KEY_ID`, `CF_TURN_KEY_API_TOKEN`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET`. Keep `ALS_LIVE_CLASS_ENABLED=false`; enable only `ALS_LIVE_POC_ENABLED` and, during recording tests, `ALS_LIVE_RECORDING_ENABLED`.

## Final verdicts for this run

1. LOCAL MIGRATION EXECUTION — PASS.
2. ACTUAL RLS/RPC SECURITY — PASS (23 authenticated assertions).
3. AUTHENTICATED CLASSROOM UI — PASS locally for Admin, Teacher, and Student; desktop and mobile browser simulation.
4. POLLING/REQUEST-COST AUDIT — PASS; fixed request baseline reduced 55.6%, measured chat payload reduced 75.0%.
5. REAL SFU TRANSPORT — BLOCKED; Cloudflare Realtime is not activated/authorized.
6. FORCED MEDIA AND DATA REVOCATION — DATA PASS; provider-media enforcement BLOCKED. Operational reconciliation and retry are implemented and locally invoked; no real SFU timing claim.
7. REAL R2 UPLOAD/RECOVERY/REPLAY — BLOCKED; existing QA bucket and credentials were not authorized/scoped for this POC.
8. TWO-HOUR RECORDING — BLOCKED / NOT RUN. Procedure is prepared; no shortened substitute counted.
9. REAL MOBILE REPLAY — BLOCKED / NOT RUN. The responsive browser simulation passed but is not physical Android/iPhone evidence.
10. PRODUCTION ENABLEMENT — NOT ENABLED. Production flags/resources/deployments were not changed.
