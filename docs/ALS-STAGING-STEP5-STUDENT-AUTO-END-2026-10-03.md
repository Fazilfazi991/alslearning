# ALS Step 5 — Student automatic ended state

## Result

**Fix implemented, locally verified and deployed to disabled staging. Hosted acceptance is BLOCKED, not passed.**

The agent accidentally included staging secret values in a browser tool result while recovering the Hostinger environment-page state. No live window was opened after this exposure. The request explicitly prohibits credential changes, so containment requires separate authorization. No new class was created. No recording, screen share, camera or microphone test was started.

| Requested verdict | Result |
| --- | --- |
| STUDENT AUTO-END STATE | PASS locally; hosted BLOCKED / NOT RUN |
| JOIN REMOVED WITHOUT REFRESH | PASS locally; hosted BLOCKED / NOT RUN |
| MEDIA STOPPED | PASS locally; hosted BLOCKED / NOT RUN |
| TEACHER NORMAL END REGRESSION | PASS locally; hosted BLOCKED / NOT RUN |
| DB CLOSURE | Hosted Step 5 NOT RUN; accepted Step 4 PASS unchanged |
| PROVIDER CLOSURE | Hosted Step 5 NOT RUN; accepted Step 4 PASS unchanged |
| CRON USED | NO |
| ACADEMIC REGRESSION | PASS — 21 read-only hosted checks |
| FINAL MEDIA STATE | SAFE — media entry disabled and zero resources |
| PHYSICAL ANDROID | NOT RUN |
| PHYSICAL IPHONE | NOT RUN |
| PRODUCTION | UNCHANGED |

There is no Step 5 class ID, End click timestamp or server-completion-to-Student-UI latency. These require the blocked real-media acceptance. Local results do not establish a hosted pass.

## Source trace and narrow change

Current source, independently inspected, initialized `classStatus` from `session.status`. Teacher lifecycle responses updated only that context. The existing private channel observed messages, participants, questions, poll responses and published tracks, with no `live_sessions` subscription. The track-discovery error `The class is not live` cleared/failed media without replacing the canonical class state.

Staging's `supabase_realtime` publication also omitted `live_sessions`. A narrowly scoped migration adds this one table, retaining its existing RLS policies and grants. No academic or session data row was changed by the migration. It was applied only to project `slghshcdaijbcjfoqerq` / `als-live-staging`, organization `oenarbsvxrmnsvugjdrz`, and verified at **2026-10-03T05:51:17.983780Z**.

`observeSessionStatus` subscribes to UPDATE events filtered by the exact class ID. It accepts only the application's existing states (`draft`, `scheduled`, `live`, `completed`, `cancelled`), ignores mismatched/invalid/older updates, and keeps terminal state from being revived by stale responses. It performs a read-only refetch on subscription/reconnection, browser focus/online/visibility return, media recovery and the authoritative not-live response. Bursts are coalesced with a one-second bound; no periodic status polling or new database writes were added.

For a Student receiving completed/cancelled, NativeClassroom synchronously updates its status reference, closes local peers, stops received tracks/capture, clears connection/publication/subscription maps and reconnect timers, and renders the existing ended UI. Join and late in-flight join results are guarded against terminal state. Teacher End retains its existing recording-stop/control/provider-closure workflow. Recording/replay API source is unchanged.

The existing eligibility, enrollment, batch and Teacher assignment checks remain in force. A Student gains no ability to write session status. Browser status reads/events remain subject to existing RLS. The before/after policy inspection showed the same SELECT/INSERT/UPDATE/DELETE predicates. The Supabase security-advisor connector denied access; no advisor PASS is claimed. Supabase changelog and current Realtime documentation were checked; no relevant breaking change required a dependency or policy change.

## Local verification

- **32 focused tests passed:** nine component lifecycle tests plus 23 recording-route tests.
- **Full Vitest suite:** 327 passed, 13 skipped, 52 passing files and three skipped files.
- **Import tests:** four passed.
- **Lint:** passed with no output.
- **Typecheck:** Next route generation plus TypeScript passed.
- **Production webpack build:** passed.
- **Diff check:** passed.

Component tests exercise an already-joined Student receiving completion, disappearance of Live/Join/audio, peer closure and track stop, blocked retained Join callbacks, cancellation, wrong-class/invalid/non-terminal events, focus/online/subscription refetch, not-live heartbeat errors, unchanged normal Teacher End, completion during an in-flight Join, and coalesced fallback bursts. They use mounted React components and mocked transport/database boundaries. These do not replace real hosted media acceptance.

Two pinned development-only packages (`react-test-renderer` 19.2.8 and its types 19.1.0) support mounted component testing. Runtime dependencies are unchanged. Hostinger reports five high-severity dependency advisories; no broad dependency upgrade or audit fix was performed in this narrow task.

## Deployment

- Application source SHA: **`3032ed0527ce801a1a675fd331be37bc2a35f002`**.
- Accepted prior application baseline: `71be353bec8ceca79e1120b614a83869c199fb97`.
- ZIP SHA-256: **`454997b2a6ab9aa723cdbc11347d04da60de47f158ad32eddf0dcb73c2dd0bf2`**.
- ZIP: 1,314,474 bytes; allowlisted source/public/build files, with no `.env`, local QA configuration or credentials.
- Hostinger deployment: **`01a1006e-eb80-7211-978c-dc8ae2bbbb22`**, **Current/Completed**.
- Submitted **2026-10-03T06:23:42.961Z** / 10:23:42.961 Dubai.
- Completion observed **2026-10-03T06:27:45.531Z**; page displayed deployed 10:26 Dubai.
- Final private readback **2026-10-03T06:33:44.171Z**: all 25 baseline settings identical; live, recording and POC flags all false. No credentials or operational window bounds were changed.
- Existing protected origin: `https://darkgreen-camel-484366.hostingersite.com`.
- No Git push or Git remote change. Production was not accessed or modified.

![Completed disabled staging deployment](evidence/als-step5-auto-end-20261003/hostinger-completed.png)

## Credential exposure and acceptance blocker

During the browser action labelled “Recover environment-page state after selection,” environment values were represented as AX text nodes rather than `Value:` fields. The attempted redaction covered only `Value:` fields, so it failed to mask secret text nodes. The agent owns this mistake. This is evidence of exposure in the conversation/tool trace; it does not prove third-party misuse.

Affected secret categories: Cloudflare SFU app secret, TURN API token, R2 object-access credentials, staging Supabase server key, staging access phrase/cookie secret and cleanup token. No secret value is repeated or stored in this report/evidence. Non-secret SFU app ID is `6306f9d5f836a1aa08b0d6bbde22f10b`; TURN key ID is `19951d8aa17f40210ffc756ba8c1ba3a`; R2 bucket is `als-live-poc-recordings`.

Media acceptance was stopped before class creation or window activation. Environment values were hidden again. Subsequent observations redact known private values before output, and only non-secret flags/comparison results were saved. The Hostinger management tab was closed after final readback.

**Separate containment authorization is required before hosted acceptance:** verify staging-only dependencies, replace the exposed staging SFU/TURN, R2, Supabase and staging gate/cleanup credentials in their existing scopes, update verified Hostinger/ignored local staging consumers, validate replacements with all media disabled, then revoke the exposed credentials/resources only after validation. Stop if a Production/shared dependency appears. No new subscription, billing change, R2 bucket or Production change is proposed. This plan has not been executed. The Step 5 prohibition on credential changes remains respected.

## Final preservation and media state

Final database observation **2026-10-03T06:37:03.025539Z** / 10:37:03.025539 Dubai:

- Zero live classes, open/reconnecting/failed connections, active/closing publications and subscriptions, open attendance and pending recording/upload/interrupted segments.
- Cleanup cron job 1 `als-live-staging-cleanup` remains paused. Latest run ID remains **72** (2026-10-01T14:39:00.025104Z); no cleanup endpoint call or cron resume.
- No Step 5 provider session created. Final read-only inspection at **2026-10-03T06:36:51.086Z** confirmed the two exact Step 4 publisher/receiver sessions remain **410 `session_error`**, no tracks.
- Step 3 recording `ea83d954-a4ef-45b6-b34c-8b80722f3b04` remains published; segment checksum, owner, duration, bytes and timestamps are unchanged. Two recording rows and two segment rows remain.
- Original enrollment IDs/statuses/start/expiry, watch total 44.013 seconds and other retained recording evidence match baseline. Migration count changed only from 46 to 47 for the status publication addition.
- Credentials, enrollment expiry, academic fixtures and accepted recording/replay workflow were not changed.

“SAFE” above describes final media resource state. Credential containment is outstanding, so no claim of credential safety or complete Step 5 acceptance is made. Stop here pending separate authorization.

Non-secret evidence is in `docs/evidence/als-step5-auto-end-20261003/`; private configuration and helpers remain ignored under `.local-qa/step5-auto-end-20261003/`.
