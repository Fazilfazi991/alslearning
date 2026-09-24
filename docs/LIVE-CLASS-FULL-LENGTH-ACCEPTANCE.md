# ALS live-class full-length acceptance

## Scope and verdicts

This report records one controlled local production-build rehearsal using the existing Cloudflare Realtime SFU/TURN implementation, private R2 recording storage, local Supabase, and synthetic ALS fixtures. It does not claim hosted-runtime, physical-device, or production acceptance.

| Gate | Verdict | Evidence |
| --- | --- | --- |
| 1. Local production-build real media | PASS | Real Teacher microphone and screen reached the Student. A granted Student screen reached the Teacher, decoded frames advanced, and revocation stopped the new publication without reload. |
| 2. Two-hour continuous capture | PASS | The single uninterrupted capture ran for 7,259.916 media seconds (120:59.916) from one Teacher tab; wall-clock segment time was 7,264.263 seconds. |
| 3. Upload recovery during capture | PASS | The deliberately interrupted part 10 retried once. Capture continued, backlog peaked at 8.5 MiB, then drained to zero; the final 41-part object has no gap or unfinished upload. |
| 4. Long-file validation/resource behavior | PASS WITH LIMITATION | The object passed local playback/seek/hash and two independent server streaming digests. No monotonic process-memory growth was observed. Browser quota headroom and the short-lived peak of the client whole-file hash were not directly measurable. |
| 5. Actual R2 replay/seek/renewal | PASS | Admin and eligible Student playback passed at start, ~30, ~60, ~90, and near-end. A real 900-second URL renewed automatically, preserved position exactly, and continued after the original URL expired. |
| 6. Physical mobile | NOT RUN / BLOCKED | No physical Android Chrome or iPhone Safari device and no approved securely reachable environment were in scope. |
| 7. Hosted runtime | NOT RUN / BLOCKED | The run is local by instruction; no hosted staging or production deployment was authorized. |
| 8. Production enablement | NOT ENABLED | ALS Production was not changed. Live and recording gates were enabled only in the bounded local test process. |

## Tested revision and environment

- Branch: `codex/cloudflare-native-classroom`
- Baseline HEAD at test start: `ade931c2b94dff981b879230cfbb92e2e0aed668` (`fix: close Cloudflare live POC evidence gaps`)
- Application: local Next.js production build (`build` then `start`), bound to `127.0.0.1:3000`
- Database/auth: local Supabase only, bound to loopback; the shared local Supabase service was intentionally left running
- Browser: Google Chrome `153.0.8010.48`
- OS: Windows 11 Pro `10.0.26200`
- Hardware: Intel Core i5-1145G7, 15.7 GiB RAM, Intel Iris Xe graphics
- Synthetic content: a locally served laboratory-science slide deck with readable diagrams and text, eight-minute slide changes, ten-minute audible sync markers, and a 90-second motion demonstration every 30 minutes. It is not a real human-taught class.

The browser/server build was scanned before the run: the current build referenced the local Supabase target, not the repository's remote `.env.local` target. The normal production live entry remained disabled. POC and recording gates were supplied only to this process. No hosted project, production configuration, deployment, or public local endpoint was created.

## Provider and allowance preflight

- Cloudflare resources: `als-live-poc-sfu`, `als-live-poc-turn`, and private Standard bucket `als-live-poc-recordings`
- R2 public access: disabled
- R2 credential: user-scoped Object Read & Write for only `als-live-poc-recordings`; expiry verified as 1 October 2026; secret values were neither printed nor committed
- Realtime allowance: 1,000 GB/month shared between SFU and TURN; overage price displayed as $0.05/GB
- Before-run Realtime usage: SFU 101.62 MB egress / 63.05 MB ingress; TURN 1.92 MB egress / 2.57 MB ingress
- Before-run R2 account state: 3.56 GB stored, 406 Class A and 698 Class B operations in the current period. The isolated bucket contained 3 objects totaling 25.57 MiB and had no unfinished multipart upload.
- Existing account-owner warning alerts at $1 and $5 were preserved. These are warnings, not spending caps.
- Internal batch stop safeguard: 10 GB estimated aggregate test egress, enforced conservatively with one Teacher, one Student, timed shutdown, and explicit connection cleanup

## Media and recording configuration

- Maximum concurrency: one Teacher plus one Student
- Classroom profile: `lecture`
- Teacher microphone sender target: 64 kbps
- Teacher screen sender target: 850 kbps at up to 10 fps
- Optional camera: not enabled for this run
- Recording canvas: 1280 x 720 at 10 fps
- Recording encoder targets: 900 kbps video and 64 kbps Opus audio
- Recording container selected by Chrome and persisted in the active segment row: `video/webm;codecs=vp9,opus`
- MediaRecorder slice: 5 seconds
- R2 multipart part size: 8 MiB
- Automatic bounded stop: 7,260 seconds (121 minutes), providing margin above the required 120 actual minutes
- Playback and upload signed-URL TTL: 15 minutes

## Production-build real-media preflight

The short preflight used actual Chrome capture and Cloudflare media, not button state or zero-publication inference.

- Teacher to Student: decoded 1920 x 794 teaching-screen frames advanced (`readyState=4`, playback not paused) and Teacher microphone received at approximately 62–65 kbps. Static-screen receive bitrate was approximately 19–30 kbps.
- Receive-only Student entry did not request microphone, camera, or screen permission.
- Student presenter grant: after the user selected a real Chrome screen source, Student screen transmitted at about 48 kbps and Teacher received about 35 kbps with advancing decoded frames.
- Revocation: the server reported `Presenter revoked. 1 publication(s) terminated`; Student screen TX and Teacher screen RX returned to zero without reload and controls remained usable.
- Loss during this proof was zero; observed RTT was approximately 25–38 ms.
- A real relay candidate was selected during the bounded preflight (roughly 270–295 ms RTT), establishing TURN relay use. The long run later selected peer-reflexive/server-reflexive paths; it is not mislabeled as relayed.
- During the scheduled moving demonstration in the long run, Student screen receive increased from approximately 19 kbps for a static slide to 159 kbps with zero reported loss and 45 ms RTT, proving that changing frames continued through the real path.

### Defects found and focused fixes

The preflight and final cleanup audit reproduced four concrete connection-lifecycle defects:

1. Publishing Student screen on the same bidirectional `RTCPeerConnection` after receiving Teacher media failed negotiation (`Failed to set remote video description send parameters for m-section`). Publishing and receiving were split into separate Cloudflare sessions/peer connections.
2. An eagerly created, still-unconnected publisher session expired before later presenter promotion. Publisher sessions are now allocated lazily on first publish.
3. An eagerly created Teacher receiver session expired before the Student's later publication. Receiver sessions are now allocated lazily on first subscription, and the local schema permits a participant without a receiver session until one is required.
4. Provider-terminal cleanup evidence could coexist with a stale local `closing` or `failed` label, causing later reconciliation to skip the row forever. Reconciliation now normalizes any `confirmed_closed` or `confirmed_absent_or_expired` row to `closed` without another provider request. A regression test covers this path.

Transport cleanup, reconciliation, stats aggregation, and tests were updated to route each operation to the correct publishing or receiving session. The changes follow Cloudflare's maintained separate publishing/receiving connection pattern while retaining serialized mutations.

## Long-run timeline and interventions

- Recording database/start timestamp: `2026-09-24T15:45:03.208Z` (19:45:03 Asia/Dubai)
- First confirmed active UI sample: `2026-09-24T15:45:05.455Z`
- Capture stopped: `2026-09-24T17:46:08.346Z` (segment row); client validation completed at `2026-09-24T17:46:21.921Z`
- Measured recording duration: 7,259.916 seconds (120 minutes 59.916 seconds)
- Segment wall time: 7,264.263 seconds from `started_at` to `stopped_at`
- Teacher tab/capture continuity: the Teacher tab was not closed or reloaded during capture
- Ordinary workflow: the synthetic presentation was foregrounded while the classroom-control tab remained in the background

### Multipart interruption and recovery

The POC harness aborted the first PUT attempt for part 10, waited 20 seconds, and then retried through the normal signing/acknowledgement flow while MediaRecorder continued:

| Observation | Captured | Backlog | Queue | Retries | Maximum acknowledgement |
| --- | ---: | ---: | ---: | ---: | ---: |
| Interruption active | 80.5 MiB | 8.5 MiB | 3 | 1 | PENDING at that instant |
| Recovered | 83.0 MiB | 3.0 MiB | 0 | 1 | 23,866 ms |

No second retry was observed after recovery. The maximum observed queue depth was 5 chunks. The final maximum acknowledgement latency was 24,204 ms; this later normal part was slightly slower than the 23,866 ms interruption sample but completed without another retry.

### Student disconnect and reconnect

- Student disconnect/reload began: `2026-09-24T16:16:28.022Z`
- Student media reconnected: `2026-09-24T16:17:08.445Z`
- Interruption: approximately 40.4 seconds
- Teacher capture advanced from 83.4 MiB to 85.3 MiB while the Student was absent
- Resumed receive measurements: Teacher microphone approximately 65 kbps, Teacher screen approximately 20 kbps, zero reported loss, 21 ms RTT, peer-reflexive path
- Post-reconnect database state: 2 active connections, 2 active publications, 3 active subscriptions; no duplicate active `(connection_id, track_id)` pair

## Resource observations

Chrome and Node values below are aggregate process-family measurements for this Windows host, not per-tab attribution. Stored recovery bytes are expected to grow with recording duration; an increase is not by itself evidence of an in-memory leak.

| Elapsed | Chrome working/private | Node working/private | Free disk | Ack parts/bytes | Teacher TX | Student RX | Active conn/pub/sub |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 93 s | 1,941.1 / 2,923.6 MiB | 512.8 / 593.4 MiB | 91.07 GiB | 0 / 0 | PENDING | PENDING | 2 / 2 / 3 |
| 394 s | 1,950.9 / 2,931.2 MiB | 518.5 / 603.7 MiB | 91.05 GiB | 2 / 16 MiB | 3,211,017 B | 3,078,040 B | 2 / 2 / 3 |
| 694 s | 1,934.5 / 2,921.0 MiB | 518.7 / 611.1 MiB | 91.04 GiB | 3 / 24 MiB | 6,240,318 B | 6,072,054 B | 2 / 2 / 3 |
| 994 s | 1,938.9 / 2,933.7 MiB | 512.0 / 610.7 MiB | 91.03 GiB | 5 / 40 MiB | 9,773,894 B | 9,299,183 B | 2 / 2 / 3 |
| 1,295 s | 1,943.9 / 2,948.3 MiB | 468.8 / 612.5 MiB | 91.01 GiB | 7 / 56 MiB | 13,079,331 B | 12,475,600 B | 2 / 2 / 3 |
| 1,595 s | 2,001.0 / 2,939.1 MiB | 436.6 / 612.1 MiB | 91.00 GiB | 8 / 64 MiB | 19,050,978 B | 18,371,057 B | 2 / 2 / 3 |
| 1,895 s | 1,852.1 / 2,844.8 MiB | 435.7 / 607.8 MiB | 90.99 GiB | 10 / 80 MiB | 22,456,526 B | 21,682,864 B | 2 / 2 / 3 |
| 3,697 s | 1,821.9 / 2,872.0 MiB | 427.4 / 610.3 MiB | 90.87 GiB | 20 / 160 MiB | 43,757,125 B | 42,340,678 B | 2 / 2 / 3 |
| 4,898 s | 1,838.6 / 2,884.9 MiB | 440.6 / 610.7 MiB | 90.79 GiB | 27 / 216 MiB | 56,570,927 B | 54,882,287 B | 2 / 2 / 3 |
| 6,099 s | 1,826.9 / 2,868.7 MiB | 443.8 / 613.6 MiB | 90.74 GiB | 33 / 264 MiB | 70,922,766 B | 69,022,117 B | 2 / 2 / 3 |
| 7,000 s | 1,815.1 / 2,867.3 MiB | 440.8 / 608.7 MiB | 90.69 GiB | 38 / 304 MiB | 81,860,407 B | 79,505,256 B | 2 / 2 / 3 |
| 7,300 s | 1,775.2 / 2,791.2 MiB | 448.0 / 620.2 MiB | 90.68 GiB | 41 / 337,011,409 B | 84,880,318 B | 82,480,951 B | 2 / 2 / 3 |

Across 25 samples, aggregate Chrome working/private memory ranged up to 2,001.0 / 2,948.3 MiB and ended at 1,775.2 / 2,791.2 MiB. Aggregate Node working/private memory peaked at 518.7 / 620.2 MiB and ended at 448.0 / 620.2 MiB. The working sets did not grow monotonically. Five-minute sampling could not capture a short-lived peak during the browser's whole-file `arrayBuffer()` SHA-256 step. Free disk fell from 91.07 to 90.68 GiB as the expected persisted recovery copy grew.

IndexedDB recovery writes were directly exercised (capture continued through upload interruption and the retry was sourced through the persisted pipeline), but Chrome did not expose a trustworthy per-origin quota/usage counter through the accessible acceptance UI. Quota headroom is therefore reported as NOT MEASURED rather than inferred.

## Long-file completion, validation, and R2 object

- Logical recording ID: `fa50c9bd-37c5-4026-8776-252d413ee06c`
- Object size: 337,011,409 bytes (321.4 MiB)
- Container/streams: WebM, VP9 1280 x 720 at 10 fps; mono Opus, 48 kHz
- Browser finite duration: 7,259.916 seconds
- Browser validation: seekable; audio and video present; full local SHA-256 matched the remote streaming digest
- Multipart manifest: parts 1–41 contiguous, zero gaps, exact byte sum, every part acknowledged with digest and ETag; final part 1,467,089 bytes
- R2 state after completion: object HEAD length/type matched; multipart ETag present; zero unfinished multipart uploads for the object
- Admin verification: second independent server streaming SHA-256/byte-count check completed at `2026-09-24T18:00:56.426Z`
- Publication: `2026-09-24T18:01:19.630Z`
- Local `ffprobe`: VP9 video plus mono 48 kHz Opus. The first ten audio seconds measured -24.0 dB mean / -3.8 dB peak, so the track is not silent.
- A visual marker transition to source elapsed `00:40:00` and the corresponding captured audio burst were within approximately one second. This is measured synthetic sync evidence, not a claim of frame-accurate lip sync.
- Upload completion after the class had already ended was NOT EXERCISED: the final multipart acknowledgement and object completion occurred before `End class`. Admin digest validation, review, and publication did complete after class end. No second long recording was started merely to force this subcase.

The normal completion path performs two distinct integrity checks:

- Client validation reconstructs the locally persisted segment, probes media metadata and a midpoint seek, then computes a full SHA-256 before requesting server validation. This is a normal completion operation, not a playback/seek/URL-renewal operation. It currently materializes the full segment in browser memory and therefore requires observation on the two-hour object.
- Server validation streams the private R2 object through SHA-256 and verifies exact byte count and digest. It does not use a whole-object `transformToByteArray()` buffer. Validation is authorized, idempotent at the state boundary, and does not run for normal playback, seek, or signed-URL renewal.

## Admin review, publication, and eligible Student replay

The Admin preview loaded the private R2 object, reported finite duration `2:00:59`, decoded 1280 x 720 frames, and passed start, 30:17, 60:47, 90:54, and 1:59:55 playback checks. The server then streamed and re-hashed the full object before changing the recording to `ready`; publication used the existing authorized action.

To avoid exposing the dedicated synthetic Admin password, the already-authenticated isolated Student fixture was temporarily assigned the local `admin` profile role for the review UI and immediately restored to `student` before replay. This changed only local Supabase synthetic data; the production access model and hosted systems were untouched.

The separate `http://localhost:3000` Student context (distinct from the Teacher's `127.0.0.1` origin and IndexedDB) then passed:

| Checkpoint | Result |
| --- | --- |
| Beginning | 0 to 2.48 seconds, decoded 1280 x 720, `readyState=4` |
| ~30 minutes | 30:14 decoded; advanced to 30:17 |
| ~60 minutes | 60:29 decoded; advanced to 60:32 |
| ~90 minutes | 90:44 decoded; advanced to 90:47 |
| Near end | 1:59:47 decoded; advanced to 1:59:50 |

All checkpoint media elements reported no error.

### Signed-link expiry and renewal

- Original issue time: `2026-09-24T18:01:50Z`; TTL: 900 seconds; normal expiry: `18:16:50Z`.
- The player renewed automatically at `18:15:20Z`, its configured 90-second pre-expiry threshold. The signature changed without a manual refresh.
- Exact paused position before and after renewal: 3,642.834435 seconds (60:42.834); `readyState=4` remained intact.
- The test waited beyond the original URL's normal expiry, then sought on the renewed URL to 3,715.429 seconds and played forward to 3,717.692 seconds with no error.
- The existing aborted/unpublished recording returned a 404 to the eligible Student. No publication or enrollment rule was weakened for this denial check.

## Directional usage and budget projections

Version-2 rows beginning at the recording start produced 121 Teacher and 120 Student samples:

- Teacher TX: 57,431,839 microphone bytes + 28,055,169 screen bytes = 85,487,008 bytes. Camera and unclassified TX were zero. Average over 7,259.977 sampled seconds: 0.0942 Mbps.
- Student RX: 56,555,878 microphone bytes + 25,925,073 screen bytes = 82,480,951 bytes. Camera and unclassified RX were zero. Average over 7,199.984 sampled receive seconds: 0.09165 Mbps.
- Student TX and Teacher RX: zero during the long run (the earlier bounded presenter preflight is separate).
- Missing receive coverage: 132.768 seconds relative to the two attendance intervals' 7,332.752 seconds of overlap, including the intentional disconnect/reconnect and sampling boundaries.
- Packet diagnostics: Student usage rows accumulated 2,134 lost-packet counter units; individual observed UI intervals were commonly zero and briefly 1–4. Maximum sampled RTT in the persisted rows was 309 ms. These browser counters are diagnostics, not billing records.
- Application activity: 241 directional usage rows, 41 signed/acknowledged multipart parts, heartbeats throughout, and no browser-console or production-server error output. Per-request byte telemetry for browser R2 range requests was not exposed, so it is not invented.
- R2 validation/inspection transfers known exactly: two full 337,011,409-byte server digest reads (Teacher validation and Admin review) plus one full 337,011,409-byte local QA stream inspection. Browser range-transfer bytes are additional but unavailable.

Measured projection for 50 average Students x 40 total class-hours:

- Measured downstream basis: 0.09165 Mbps per Student.
- Delivered media: 82.48 GB decimal; with 20% engineering headroom: 98.98 GB.
- This is below the verified 1,000 GB shared SFU/TURN allowance, even after the approximately 0.1 GB prior account usage observed before the run. Projected Realtime overage at these assumptions is $0.00; it is not a billing cap or guarantee.
- The low result reflects mostly static synthetic lecture content. Higher-motion teaching, protocol overhead, TURN routing, other account traffic, and provider accounting differences are excluded.

Recording-library projection from the measured 0.37137 Mbps recording bitrate:

- 40 recorded hours: 6.685 GB.
- 240 library hours: 40.108 GB.
- Against a 10 GB R2 storage allowance, 240 hours would be about 30.108 GB over; at the displayed $0.015/GB-month storage rate, about $0.452/month before request operations, taxes, and other stored objects.

Directional counters will be reported independently. Teacher TX and Student RX are not added together and labeled as Cloudflare billed egress. Provider dashboard usage can lag and is marked unavailable if it has not settled.

The historical `$5.47` scenario remains planning context only and is not treated as a guarantee or as a target result.

Provider analytics after the run were still account/application aggregates, not a per-test invoice:

- SFU last 30 days: 291.97 MB egress / 255.10 MB ingress (preflight snapshot 101.62 / 63.05 MB; the difference includes the bounded preflight and any intervening app activity, so it is not substituted for the version-2 run counters).
- TURN last 30 days: 3.15 MB egress / 6.16 MB ingress (preflight snapshot 1.92 / 2.57 MB). The full-length run used peer/server-reflexive paths; the relay evidence came from the short preflight.
- R2 dashboard immediately after the run still displayed the stale 25.57 MB bucket size and 26/44 Class A/B operations even after refresh. The direct object HEAD, multipart listing, and database manifest are the completion evidence; delayed dashboard metrics are explicitly not treated as an invoice.

## Physical-device checklist (prepared, not executed)

Run this only on actual devices against a securely reachable, explicitly approved environment:

1. On Android Chrome and iPhone Safari, sign in as an eligible Student and join without publisher permissions.
2. Confirm audible Teacher audio starts through the platform-appropriate user gesture and remains synchronized with the visible marker.
3. Confirm shared laboratory text/diagrams remain readable in portrait, landscape, and fullscreen.
4. Disconnect and reconnect each device; verify authorized media resumes once and no duplicate audio/video appears.
5. Replay both the six-minute fixture and the two-hour R2 object from the beginning, middle, and near end.
6. Verify finite duration, range seeking, audio/video sync, and automatic signed-URL renewal with position preservation.
7. Record Safari-specific metadata/range behavior, browser/OS versions, device model, network path, and failures.

A narrow viewport, emulation, or desktop WebKit is not accepted as physical-device evidence.

## Verification and cleanup

Final local verification completed after the focused fixes:

- `pnpm typecheck`: PASS
- `pnpm lint`: PASS
- `pnpm test`: PASS, 38 Vitest files / 247 tests plus 4 Node import tests
- Local production build through the bounded POC environment launcher: PASS; Next.js 16.3.3 compiled, typechecked, and generated all routes
- Targeted transport cleanup/reconciliation tests: PASS, 2 files / 6 tests
- Staged diff whitespace check: PASS

The final data audit found 27 subscription rows and 9 publication rows whose provider reconciliation outcome was terminal while their local status was still `closing` or `failed`. The isolated local rows were normalized according to the focused fix. The closing audit then reported:

- Session `60000000-0000-0000-0000-000000000001`: `completed`, ended `2026-09-24T17:47:15.988Z`
- Active/reconnecting/closing/failed media connections: 0
- Active/closing/failed publications: 0
- Active/closing/failed subscriptions: 0
- Open attendance intervals: 0
- Recording: `published`; one `ready` segment; 41 parts totaling exactly 337,011,409 bytes
- Synthetic fixture roles restored: assigned Teacher remained `teacher`; Synthetic Students 1–5 were all `student`
- Teacher and Student pages were exited; test tracks, publishers, receivers, retry loops, and presentation/monitor processes were stopped
- Local application and synthetic-presentation listeners on ports 3000 and 3040 were closed. The local Supabase listeners on 55321/55322 and its healthy database container remain running as required.
- Local POC and recording feature gates are disabled because the only process that received them was stopped. No hosted or production flag was changed.

Remaining provider/resource state:

- The Cloudflare Realtime subscription remains active; stopping this test did not cancel it.
- `als-live-poc-sfu`, `als-live-poc-turn`, and private Standard bucket `als-live-poc-recordings` remain in the verified account.
- R2 public access remains disabled. The published recording object and its database/recovery evidence were preserved.
- The staged user-scoped R2 Object Read & Write credential remains limited to that bucket and expires 1 October 2026. No secret value was printed or committed.
- Existing $1 and $5 usage-spend warnings remain saved; they are warnings, not caps.
- ALS Production, hosted staging, deployments, and production live-class flags were not changed.
