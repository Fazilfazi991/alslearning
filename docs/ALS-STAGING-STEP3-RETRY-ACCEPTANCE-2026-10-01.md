# ALS Step 3 retry — recording/replay accepted; normal Teacher End remains unverified

Final checkpoint: 1 October 2026, 18:21 UTC / 22:21 Dubai. The original retry established hosted microphone and screen reception, an uploaded recording, digest validation, and genuine Admin playback review. After explicit owner approval, the narrow recording-lifecycle gate fix was tested and deployed to the existing Hostinger staging app. The exact retained recording was approved and published through the genuine Admin UI; eligible Student replay, seeking, renewal, and expired-account denial passed. The owner confirmed recorded Teacher voice, Marker A/SLIDE A and Marker B/SLIDE B alignment, no material sync issue, and no private content. No additional class or media window was created for the fix. Normal Teacher End remains **FAIL/UNVERIFIED**: scheduled hard end occurred before that action completed.

## Current verdicts

| Requirement | Result and scope |
| --- | --- |
| TEACHER AUDIO TRANSPORT | **PASS** |
| OWNER AUDIBILITY | **CONFIRMED** — owner answered Yes for the live Student session |
| SCREEN CAPTURE STAGE A | **PASS** — normal capture returned a live screen, local preview decoded, normal publication succeeded |
| TEACHER SCREEN PUBLICATION | **PASS** — ALS and exact replacement SFU agree |
| STUDENT SCREEN RECEPTION | **PASS** — matching subscription, increasing screen bytes, advancing decoded video, visible A→B change |
| OWNER READABILITY | **CONFIRMED** — owner answered Yes for SLIDE B |
| NORMAL TEACHER END | **FAIL/UNVERIFIED — unchanged** — late action returned `Only a live class can be ended`; scheduled cleanup completed the class first |
| NEW HOSTED RECORDING | **PASS for capture/persisted/uploaded media**; duration was **184.958 seconds**, exceeding the requested 60–120-second target |
| R2 UPLOAD + VALIDATION | **PASS** — byte count and independently streamed digest match; client playback evidence has finite duration, seeking, audio and video |
| ADMIN PLAYBACK REVIEW / APPROVAL | **PASS** — owner content review confirmed; genuine Admin approved through normal UI with flags false |
| PUBLICATION | **PASS** — same recording is `published`, segment `ready`; normal Admin Publish succeeded |
| STUDENT REPLAY | **PASS** — normal catalogue discovery and playback, finite duration, unmuted audio playback and decoded video; audible recorded voice confirmed by owner review of this same unchanged object |
| SEEKING | **PASS** — genuine Student player seeks to middle and near end and resumes after each |
| SIGNED-LINK RENEWAL | **PASS** — genuine Student Renew playback issued fresh authorization, preserved position and continued playing |
| EXPIRED / INELIGIBLE DENIAL | **PASS** — no discovery, direct replay page 404, playback authorization API 403 |
| FINAL CLEANUP | **PASS for safe media state** — all media/attendance/in-flight upload categories zero; cron paused; live/recording entry disabled |
| PHYSICAL ANDROID / PHYSICAL IPHONE | **NOT RUN / NOT RUN** |
| PRODUCTION | **UNCHANGED** |

The requested post-class fix and retained-recording acceptance are complete. Overall Step 3 still has the separate Normal Teacher End gate and the original duration deviations below. Only the recording POST feature-gate boundary and focused tests changed. Academic fixtures, enrollment expiry, credentials, provider resources and Production were preserved; no Git push occurred.

## Approved post-class fix — final requested verdicts

| Requested verdict | Result |
| --- | --- |
| POST-CLASS GATE FIX | **PASS** |
| NEW CAPTURE WHILE DISABLED | **CORRECTLY DENIED** |
| ADMIN APPROVAL | **PASS** |
| PUBLICATION | **PASS** |
| ELIGIBLE STUDENT REPLAY | **PASS** |
| STUDENT SEEKING | **PASS** |
| STUDENT SIGNED-LINK RENEWAL | **PASS** |
| EXPIRED/INELIGIBLE DENIAL | **PASS** |
| ACADEMIC REGRESSION | **PASS** |
| FINAL MEDIA STATE | **SAFE** |
| NORMAL TEACHER END | **FAIL/UNVERIFIED — unchanged** |
| PHYSICAL ANDROID | **NOT RUN** |
| PHYSICAL IPHONE | **NOT RUN** |
| PRODUCTION | **UNCHANGED** |

### Boundary and verification

The defect was in `src/app/api/live-classes/[classId]/recordings/route.ts`: POST applied both recording and classroom/POC entry feature gates before distinguishing capture from legitimate existing-recording operations. The fix obtains configuration without asserting entry flags, and applies both entry assertions only to `begin`. Existing same-origin/authentication/rate limits, class mode and role authorization, bounded owner recovery, owned-segment/state checks, R2 configuration, object digest/byte verification, and canonical Admin `validating → ready → published` prerequisites remain. GET review/playback/renewal was already independent of entry flags and is unchanged. No RLS, database migration, provider-creation route or classroom-start/join route changed. Signing multipart parts still requires an authorized existing owned segment and current recovery policy; it cannot create a new capture.

Focused handler regression tests: **23 passed** covering requirements A–I, including false flags with an open window/live class, approved review/publication, pre-publication denial, replay/renewal, ineligible/expired/wrong-scope denial, Student/Teacher mutation denial, incomplete/aborted/failed/wrong-class/missing evidence, digest/byte mismatch, and bounded existing-owner recovery. Full applicable Vitest: **318 passed / 13 skipped**, 51 files passed / 3 skipped. ESLint, Next route type generation, TypeScript checking, and production webpack build all passed before deployment. Hosted new-capture POST returned 403 `Staging test window is closed`; the focused handler tests independently establish denial from false feature flags with an open test window.

### Reviewed source and staging deployment

- Application source commit: **`71be353bec8ceca79e1120b614a83869c199fb97`** (`Fix recording lifecycle gates after capture shutdown`).
- Accepted prior source: `a267b969b6c6e355d183db585f3dac9a9f8d0c07`.
- ZIP SHA-256: **`e4e19cc77e6d0e0fca862bd02d5c0099d6283dafe3ad5526d6c689b409537828`**, 1,308,775 bytes / 266 entries.
- Only the existing recording route and added regression test differ from the accepted ZIP; all other file contents match exactly. Private configuration and fixtures are excluded.
- Existing Hostinger staging deployment: **`01a0f8a7-6338-7357-b6db-cbb8ad5d1ac1`**, **Current/Completed**, submitted **18:08:34 UTC / 22:08:34 Dubai**, completed approximately **18:10 UTC / 22:10 Dubai**.
- The initial packaging attempt was rejected before deployment as unsupported structure. Rebuilding with the accepted archive metadata resolved it; the existing app was unaffected by the rejected upload.
- All **25** staging environment values matched the preserved configuration before and after deployment. `ALS_LIVE_CLASS_ENABLED=false`, `ALS_LIVE_RECORDING_ENABLED=false`, `ALS_LIVE_POC_ENABLED=false`; prior expired operational bounds remain. R2, Supabase, SFU and TURN configuration are unchanged.

### Actual lifecycle and Student acceptance

The genuine Admin loaded the exact retained recording, then clicked **Approve after playback review** and **Publish** through the normal UI. Recording became `ready`, then `published`; its sole original segment became `ready`. **verified_at: 2026-10-01T18:13:36.449Z** / Dubai 22:13:36.449; **published_at: 2026-10-01T18:14:54.137Z** / Dubai 22:14:54.137. Class/Teacher/segment/private object/digest ties are preserved. No SQL or direct service-role status mutation was used. Media remains **184.958 seconds / 4,451,838 bytes / one multipart part**.

Eligible Student 1 signed in normally, found **Replay lesson** in the normal class catalogue, and opened the published recording. Native player observation: duration **184.958**, readyState 4, **1280×720**, unmuted; normal playback advanced to **21.384997** seconds. Native middle seek reached **92.479**, resumed unpaused at **92.564873**, and continued to **108.674043**. Near-end seek reached **175.7101**, then resumed unpaused at **175.80948**, readyState 4, showing SLIDE B. Owner audibility evidence is their explicit review of the same unchanged retained media; browser observations establish unmuted Student playback and decoding, not a new human listening confirmation.

At **18:19:17.484 UTC**, normal **Renew playback** produced a different private signed authorization. Position advanced **108.674043 → 121.333183** over 15.163 wall-clock seconds, stayed playing and readyState 4, and did not reset to the beginning. No TTL override, direct object URL, source modification, or authorization bypass was introduced. Signed URLs and credentials are omitted from evidence.

The separate expired/ineligible synthetic Student signed in normally without eligibility changes. Its catalogue showed **No eligible live classes**, with no replay link. The observed eligible replay path returned **404** for this identity; the normal recording authorization endpoint independently returned **403 / Current enrollment does not permit this classroom**. Eligible normal authorization returned 200 with published status, one segment, the original duration/bytes, and renewal available at **18:20:33.423 UTC**. Prior unpublished authorization returned 404 with `Recording is unavailable`; no playable authorization was issued before publication.

### Final preservation and quiet state

All **22 academic fixture/authorization checks passed after deployment**. Watch history **44.013 seconds**, five enrollment rows, exact starts **2026-10-01T07:40:22.181Z**, expiry **2026-10-08T07:40:22.181Z**, and 46 migrations remain unchanged (preservation observed **18:12:24.649557 UTC**).

Final read-only preservation inspection after replay at **19:04:16.583576 UTC / 23:04:16.583576 Dubai** reconfirmed watch history **44.013 seconds**, all five identical enrollment rows, 46 migrations, the recording still `published`, original verified/published timestamps, and the original ready segment/digest/byte count. No preservation data was changed to obtain these results.

Final database observation **18:20:29.390136 UTC / 22:20:29.390136 Dubai**: **0 live classes, 0 open/reconnecting or unresolved connections, 0 active/closing publications, 0 active/closing subscriptions, 0 open attendance, 0 recording/upload/interrupted segments**. Cleanup cron job 1 `als-live-staging-cleanup` is paused. Protected cleanup availability check returned 200 with zero candidates/changes; this quiet-state check is not offered as evidence of normal Teacher End.

Exact replacement SFU publisher and receiver inspection began **18:20:27.541 UTC** and was saved **18:20:39.724 UTC**: both exact sessions returned **410 / session_error**, confirming terminal provider state. No new provider resource, live class, capture or recovery loop was created during the fix. The published replay remains available as authorized post-class learning. Student replay and expired-account test tabs are closed; no classroom page remains open. Hostinger settings tab closure encountered `Debugger unattached`; it is a non-media dashboard, with no pending configuration changes. The task-owned teaching server had already stopped.

Safe final images: [Admin published recording](evidence/als-step3-retry-20261001/admin-recording-published.png), [Student beginning](evidence/als-step3-retry-20261001/student-published-replay-beginning.png), [Student near-end replay](evidence/als-step3-retry-20261001/student-published-replay-near-end.png), [expired catalogue denial](evidence/als-step3-retry-20261001/expired-no-replay-discovery.png), [expired direct replay denial](evidence/als-step3-retry-20261001/expired-direct-replay-denied.png), [completed fix deployment](evidence/als-step3-retry-20261001/lifecycle-deployment-completed.png). Detailed non-secret final observations are retained in ignored `.local-qa/step3-retry/lifecycle-deployment.json`, `student-replay-evidence.json`, `student-renewal.json`, `lifecycle-http-published.json`, `quiet.json`, and `provider-2026-10-01T18-20-39-724Z.json`.

## Historical live retry evidence (before the approved lifecycle fix)

The following timings and original blocker are preserved as historical evidence. Current publication/replay status is established above.

## IDs and timings

- Fresh class: `7385751c-3640-4db3-9a45-5348e682cffe`, **Synthetic ALS Screen Recording Replay Retry — 1 Oct 2026**.
- Recording: `ea83d954-a4ef-45b6-b34c-8b80722f3b04`.
- Segment: `5d65817a-2a15-4013-9504-f81f8ece728c`.
- New window: **14:27–14:47 UTC / 18:27–18:47 Dubai**. Configuration deployment `01a0f7d7-167f-706a-ba28-0a52b0e9bf37` was Current/Completed by approximately 14:23, before the window opened. All 25 values matched privately; `.next` output and prior source were used. Prepared sessions were reloaded before Start.
- The same unused class schedule was adjusted normally to end at **14:37 UTC**, independently enforcing the ten-minute class bound from the operational opening. No second class was created.
- Teacher attendance opened **14:27:41.142482**; Student **14:27:42.070679**. Both closed **14:37:02.492**, approximately **9 minutes 21 seconds** after Teacher Join.
- Microphone publication: **14:28:06.414757–14:37:00.769**, approximately **8 minutes 54 seconds** of actual SFU media. Screen publication: **14:31:35.679668–14:37:00.769**, approximately **5 minutes 25 seconds**. The 3–5-minute overall live target was exceeded; the ten-minute bound was retained.
- Segment began **14:34:30.419527** and stopped **14:37:36.511**. Player/client validated media duration **184.958 seconds**. The planned short capture was not stopped within its 60–120-second target. This timing deviation is preserved rather than presented as a successful short run.
- Size **4,451,838 bytes**, **one multipart part** (server part size 8,388,608). No interruption or extra part was manufactured.
- Part acknowledgement **14:37:46.737**, multipart completion **14:37:50.921**, client/Worker/server validation **14:37:53.464**. Independent R2 HEAD and streamed SHA-256 verification **14:38:56.073** returned HEAD 200 and exact byte/digest matches.
- Historical disabled deployment: **`01a0f7eb-65c9-7219-bc05-53ccdf014dfa`**, Current/Completed around **14:45**, superseded by the reviewed lifecycle-fix deployment above. All 25 accepted baseline values privately matched again at **14:47:05.228**; live/recording/POC false and prior expired bounds restored.

## Media evidence

Replacement SFU `als-staging-sfu-containment-20261001`, app `6306f9d5f836a1aa08b0d6bbde22f10b`; TURN `als-staging-turn-containment-20261001`, key ID `19951d8aa17f40210ffc756ba8c1ba3a`. Supabase remains `slghshcdaijbcjfoqerq`; existing private R2 bucket remains `als-live-poc-recordings`.

Teacher connection `938f488f-c374-4cdb-baee-45d24473a03c`, publisher session `355aeecdadfface27d0f854a88140063b5874c52335388d5360e9559326ce068`. Student connection `1afd29e2-b982-490c-82d0-a24e940d9bed`, receiver session `dd3613c07e6b7fec75409c32c573bf0abd765949162a39f251cfa6b4c4e7aa96`. Exact publisher and receiver sessions showed both active local/remote microphone MID 0 and screen MID 1 in the replacement app. Both exact sessions subsequently returned **410 / session_error** at **14:40:51.364** (an earlier inspection timed out and is not counted as proof).

Microphone publication `881b700e-44e7-4edc-8f4b-5818edcfabe2`; screen publication `74fd446c-854d-494c-8c6d-9a8d57d277d8`. Matching subscriptions `23bce337-c3d2-4cf2-ad8c-f3277eab042d` and `f8d2e7cf-0cad-4e2a-96f2-b57b74cb42f4`.

Student audio readyState 4, unpaused/unmuted, currentTime **11.202185→32.935187** between **14:28:21.665–14:28:43.398**. Persisted Student microphone RX increased **646,266→1,122,646→2,079,455→3,985,007 bytes**. Student microphone TX and all camera counters remained zero.

Normal screen capture produced a decoding Teacher preview at **1920×708**, readyState 4 and advancing time. Student corresponding screen video was also **1920×708**, readyState 4, advancing **61.024674→127.67719** with actual visual A→B changes. Student screen RX increased **318,128→2,164,983 bytes**, TX zero. Stages A–H were established through the normal capture/preview/publication path, exact provider/DB correspondence, receive counters and changing rendered video. A numeric decoded-frame counter was unavailable through the browser observation API; none is fabricated.

Owner confirmed live sound and SLIDE B readability, and subsequently confirmed speaking Marker A and Marker B. The genuine Admin preview actually played at the beginning, through the middle section and near end with finite duration **184.958**, readyState 4, 1280×720 decoded video and native seeking/resumption. The owner's subsequent explicit recording review confirmed audible Teacher voice, both markers aligned with their slides, no material audio/video sync problem, and no private classroom/dashboard content. At the historical 15:05 checkpoint, recording remained `validating` because normal approval was rejected, with a retained local recovery copy and no in-flight upload/recovery loop. It is now normally approved and published as documented above.

Normal supported Renew playback obtained a different private signed authorization, preserved the position from approximately **92.47988** seconds, and continued playing to **134.479934** with readyState 4. No signed URL was emitted; no TTL bypass or source change was introduced.

## Shutdown and preservation

Scheduled job/request **70**, at **14:37**, returned HTTP 200: one expired class, two candidate connections, two closed publications and two closed subscriptions, zero failed closures. Runs/requests **60–72** have SQL succeeded and HTTP 200. The class completed at **14:37:00.173**; publications closed with `confirmed_closed` at **14:37:00.769**, connections and attendance at **14:37:02.492**. Teacher End later returned the class-not-live error, so this run does not establish the normal ending workflow.

Student received `The class is not live`, stopped media, and on reload displayed **This class has ended**. Cron paused at **14:39:03.713**. Final database inspection **14:47:18.381797** and quiet-state check **14:48:29.756299** found **0 live classes / 0 unresolved or open/reconnecting connections / 0 active or closing publications / 0 active or closing subscriptions / 0 open attendance / 0 recording, uploading or interrupted segments**. Exact provider active sessions: **0**, both explicitly expired. The post-run protected cleanup check returned 200 with zero candidates or changes; it was not used to cause live-run closure.

All 22 academic fixture checks passed before the run, watch history **44.013 seconds** preserved. Five enrollment rows and 46 migrations remain unchanged, rechecked **14:47:17.823806**: exact enrollment start **2026-10-01T07:40:22.181Z**, expiry **2026-10-08T07:40:22.181Z**. The unrelated healthy fixture matches the Step 2 historical row exactly; Step 2 class/evidence remains unchanged. Current R2/Supabase/SFU/TURN credentials matched the preserved configuration throughout.

At the historical 15:05 checkpoint, Teacher, Student live room, teaching and Hostinger test tabs were closed and the local teaching server stopped. The eligible Student catalogue test tab was also closed. Genuine Admin review was a paused playback handoff for the fix decision (paused at 92.47988 seconds, readyState 4); no active classroom existed. That handoff has now been completed above.

Post-approval-attempt database inspection at **15:03:49.475949 UTC** confirmed recording `validating`, no verified/published timestamps, all five active media/attendance/upload categories zero, and cron inactive. Enrollment/migration preservation was rechecked at **15:04:12.943508 UTC**; all 22 academic fixture checks passed again, watch history remained 44.013 seconds. Student 1 signed in normally and its live-class catalogue showed the completed class without a replay link, consistent with the unpublished state. No new class or operational window was created.

## Historical Admin approval blocker (resolved)

The server route `src/app/api/live-classes/[classId]/recordings/route.ts` calls `assertLiveFeature("recording")` and `assertLiveFeature(body.mode)` for every POST before classifying `review`, `publish`, and `unpublish` as manager actions. Thus the normal UI cannot approve/publish while the required `ALS_LIVE_CLASS_ENABLED=false` and `ALS_LIVE_RECORDING_ENABLED=false` state is preserved. GET preview/renewal does work while disabled; that does not establish POST approval support.

At the historical checkpoint a separate narrow fix authorization was requested. The owner subsequently approved the existing-recording lifecycle boundary, including bounded post-class owner recovery. That approval was implemented and verified above: new capture is still gated, while authorized existing-recording operations retain all their ownership, state, digest and time-window controls.

No code or deployment change was made before that separate approval. Entry flags remained false throughout the approved fix and acceptance.

## Remaining gate

The approved fix, normal Admin approval/publication, eligible Student replay/seek/renewal and expired denial are complete. Stop this task with entry disabled and cron paused. **Normal Teacher End remains FAIL/UNVERIFIED** and would require separately authorized future acceptance; it cannot be retroactively made PASS by this post-class fix. Physical Android and iPhone were not run. No further class or media window is authorized in this task.

Safe images: [Student received SLIDE A](evidence/als-step3-retry-20261001/student-recording-slide-a.png), [Student received SLIDE B](evidence/als-step3-retry-20261001/student-recording-slide-b.png), [Admin beginning](evidence/als-step3-retry-20261001/admin-beginning.png), [Admin near end](evidence/als-step3-retry-20261001/admin-near-end.png), [final disabled deployment](evidence/als-step3-retry-20261001/final-disabled-deployment.png). Detailed non-secret evidence is under ignored `.local-qa/step3-retry/`. Secrets, signed URLs, cookies and passwords are excluded.
