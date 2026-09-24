# Live-class POC closeout addendum — 24 September 2026

This addendum closes the four defects/evidence gaps identified after the real-provider and hardening acceptances. It preserves those reports rather than restating the already accepted SFU, TURN, and short-recording results.

## Scope and safety

- Branch: `codex/cloudflare-native-classroom`
- Starting commit: `b88a4022a121a3622eff8368095e6d15a2d526ba`
- Test environment: local application and local Supabase only
- Provider resources: existing `als-live-poc-sfu`, `als-live-poc-turn`, and private `als-live-poc-recordings` only
- Maximum live participants used in this closeout: one Teacher and one Student
- Cloudflare subscription, payment method, alerts, other buckets, and production resources were not changed.
- No hosted staging, production flag, deployment, push, merge, new subscription, credential replacement, soak test, or 50-receiver test was performed.
- The scoped R2 credential remained valid for the run and retains its verified 1 October 2026 expiry. Its value was neither printed nor committed.

## Acceptance result

| Gap | Result | Evidence |
| --- | --- | --- |
| Screen/camera statistics classification | PASS | Directional, disjoint application-source categories; real Teacher screen TX and Student screen RX; zero unclassified bytes |
| Presenter-triggered runtime error | PASS with tooling finding | Original exact exception traced to React development owner-stack capture colliding with the controlled-browser environment; affected development flow and local production-build control transitions completed without recurrence or reload |
| Historical provider cleanup uncertainty | PASS | All 28 retained failed evidence rows reconciled as provider session absent/expired; original failures retained |
| Interrupted multipart upload recovery | PASS | Playable 16,929,187-byte R2 object completed from three ordered parts after a forced later-part interruption and interface reopen; full-file digest matched |

## 1. Directional media accounting

The old sampler classified every inbound video RTP row as camera, inferred identity from browser statistics, reused cumulative counters, and had no sent/received separation. That made a working screen share appear as generic camera/video traffic and left `screen_bytes` at zero.

The corrected sampler resolves RTP identity from ALS publication/subscription metadata:

- receiving transceiver `mid` is mapped to the subscribed publication kind for that receiving connection;
- sender `mid` is mapped to the local ALS publication kind;
- track identifier is only a lookup key into registered app metadata, not a source-type heuristic;
- microphone, camera, screen, and unclassified are disjoint for each direction;
- sent and received counters remain separate;
- only interval deltas are persisted, first samples and stale rows contribute zero, counter resets restart the baseline, and inbound loss uses an interval delta;
- 60-second persisted intervals do not overlap.

Legacy rows are marked classification version 1 and were not reclassified because their source identity was not retained. New rows use version 2.

Real measurement used the lecture/slides profile with one Teacher and one Student. Across 15 intervals per participant, the version-2 RTP payload accounting was:

| Direction/category | Bytes |
| --- | ---: |
| Teacher sent microphone | 6,932,085 |
| Teacher sent camera | 0 |
| Teacher sent screen | 832,028 |
| Teacher sent unclassified | 0 |
| Student received microphone | 5,784,399 |
| Student received camera | 0 |
| Student received screen | 564,718 |
| Student received unclassified | 0 |
| Total | 14,113,230 |

The categories reconcile exactly: `12,716,484` microphone bytes plus `1,396,746` screen bytes equals the `14,113,230` total. Camera and unclassified were both zero. A representative 60-second screen interval recorded 158,368 Teacher TX bytes (about 21.1 kbit/s) and a receiving interval recorded 168,456 Student RX bytes (about 22.5 kbit/s). These are payload measurements, not a Cloudflare invoice estimate.

## 2. Presenter runtime incident

The retained incident was:

```text
TypeError: Cannot assign to read only property 'stackTraceLimit' of function 'function Error() { [native code] }'
```

Inspection located the assignment in React's development JSX owner-stack capture, which temporarily assigns `Error.stackTraceLimit = 10`. In the controlled-browser evaluation environment used when the incident appeared, that property was observed as non-writable and non-configurable. The application has no `stackTraceLimit` write and no presenter/render path that mutates the Error constructor. React's production JSX runtime contains no such assignment.

The application-side presenter and cleanup paths were still hardened: Teacher preflight state no longer delays initial local publication after join, screen-track termination uses an event listener, revocation/removal closes the exact registered publication, and terminal provider-session responses are persisted instead of producing endless retry state.

Verification:

- Development server: real Teacher-to-Student media and Student screen delivery were active; presenter grant/revoke was repeated three times; Teacher and Student consoles remained clear and the control surface remained usable without reload.
- Local production build/start: three grant/revoke cycles plus a final revocation completed; the Student share control appeared on grant and disappeared on revoke; Teacher and Student console error/warning captures were empty.
- The production run created no publications or subscriptions because no new screen chooser was opened. Its two empty provider sessions later returned HTTP 410 and were reconciled locally.

No application exception was suppressed, no overlay was disabled, and no reload workaround was added. The original exception is closed as a development-tooling conflict based on its exact write site and the production-runtime difference, not merely because one later run lacked an overlay.

## 3. Historical provider cleanup reconciliation

The current local dataset contained 9 failed publication rows and 19 failed subscription rows. This is one more subscription row than the earlier report's 18; the closeout audited the current 28 rows rather than repeating the prior count.

Grouping by provider session and session-specific `mid` produced 28 distinct logical track resources across 16 provider sessions. Ten session inspections returned Cloudflare HTTP 410 with `session_error`. Six inspections initially timed out; a bounded follow-up using each exact retained session and `mid` also returned HTTP 410 with `session_error`. A timeout itself was not treated as success.

Result:

| Evidence rows | Logical resources | Provider sessions | Confirmed closed | Confirmed absent/expired | Unresolved |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 28 | 28 | 16 | 0 | 28 | 0 |

The original failed statuses and error history remain intact. Additive reconciliation fields record the terminal outcome, observation time, HTTP status, provider error code, and detail. Terminal rows have no retry scheduled and are skipped by routine reconciliation. New cleanup treats an explicit expired/absent response as terminal while retaining bounded retry behavior for genuinely unresolved failures.

A short new grant/revoke/leave sequence added no failed cleanup rows. Final production-build test sessions contained zero provider tracks; both exact provider session inspections returned HTTP 410 before their local connection rows were closed.

## 4. Multipart interruption and recovery

The prior 2,066,298-byte recording remains valid evidence for one-part upload and replay only. The prior recovery after a duration-validation failure remains valid post-upload validation recovery only.

The new Teacher-composite recording is `51622135-79e7-44b0-aa9c-fd818b16ff90`, segment `137085af-0cad-49c7-be9c-23a2c16dfc90`. It used one multipart upload identity throughout.

| Part | Bytes | Result |
| ---: | ---: | --- |
| 1 | 8,388,608 | Uploaded, present in provider part listing, and acknowledged before interruption |
| 2 | 8,388,608 | First PUT deliberately interrupted before acknowledgement; persisted bytes and expected digest retained; reuploaded after provider reconciliation showed it missing |
| 3 | 151,971 | Nonempty final part uploaded during resumed completion |
| Total | 16,929,187 | Three-part R2 object completed and validated |

Capture duration was 364.483 seconds. The interface was closed and reopened after part 2's forced interruption. Recovery retained upload ownership, upload ID, ordered bytes, and acknowledgement metadata; listed provider parts; skipped the already verified part 1; reconciled the uncertain part-2 outcome; uploaded only the missing part and final part; and completed the same upload.

After completion, the server downloaded the actual R2 object and computed its SHA-256. That full-file digest matched the ordered local IndexedDB reassembly and was persisted. Multipart ETag was not used as a content hash.

Separate recording outcomes:

| Case | Result |
| --- | --- |
| One-part upload | PASS — earlier 2,066,298-byte playable object retained and correctly relabelled |
| Multiple-part upload | PASS — 16,929,187 bytes, three ordered parts |
| Interrupted later-part recovery | PASS — part 2 interrupted before acknowledgement and recovered after provider listing |
| Recovery after reopening Teacher interface | PASS — same upload resumed after close/reopen |
| Post-upload validation recovery | PASS — earlier duration-validation recovery retained and correctly relabelled |
| Actual remote playback/seek/renewal | PASS — Admin and eligible Student used the completed R2 object, not a Teacher-local Blob URL |

Teacher local validation decoded a finite 364.483-second 1280×720 recording with audio and seekability. Admin review decoded the actual R2 object, sought into the recording, renewed the signed playback URL, and published it. Chromium initially exposes an uncued MediaRecorder WebM as infinite-duration over remote playback, so the authorized player now performs the same bounded far-seek metadata probe used by Teacher validation and then restores the requested position. The eligible Student's actual R2 playback consequently reported a finite 364.483-second duration and decoded at 1280×720 with an unmuted audio stream. Playback was verified near the start at 0.896 seconds, at the midpoint from 182.241 seconds, and near the end from 361.611 seconds. Signed-URL renewal at 182.241 seconds restored exactly 182.241 seconds after the new object URL loaded. The test did not rely on a Teacher-local Blob URL or concatenate unrelated recorder instances.

## Resource use and final state

- Live regression: one Teacher plus one Student; no five-receiver, 50-receiver, or soak run.
- Version-2 RTP payload measured during the batch: 14,113,230 bytes (about 0.014 GB), far below the 10 GB internal stop threshold. Recording storage bytes are reported separately above.
- Media connections: 18 closed, 9 stale, 0 active.
- Publications: 6 closed, 9 historical failed, 0 active.
- Subscriptions: 4 closed, 19 historical failed, 0 active.
- Unfinished recordings/uploads: 0.
- Test publishers, receivers, peer connections, media tracks, and retry loops: stopped.
- Recording and recovery evidence: preserved.
- Local app server: stopped.
- Local live gates: disabled because no test process is running and no environment file was changed. `ALS_LIVE_CLASS_ENABLED` remains false by default; the POC-only interruption switch was process-scoped and removed before the production run.
- Local Supabase remains running to preserve the accepted evidence and because it is a shared local dependency; no unrelated local service was stopped and no data was deleted.
- Existing Realtime subscription, POC resources, and $1/$5 warning alerts remain in place. No subscription or account setting was changed in this batch.

## Verification commands

The final repository verification used the actual `package.json` scripts:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

All completed successfully. The test runner reported 37 test files and 245 tests passing, followed by the repository's Node tests. The focused media tests include RTP classification/reset/stale-row cases, terminal 410 cleanup, and multipart provider/local part reconciliation.

## Deferred acceptance

The two-hour recording, physical Android/iPhone testing, hosted staging, production enablement, and production release remain separate, explicitly unapproved decisions. This closeout does not claim them.
