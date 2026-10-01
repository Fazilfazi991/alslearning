# ALS Step 3 — incomplete hosted lesson acceptance, 1 October 2026

## Verdicts

FAIL below means the requested acceptance was not completed; it does not imply an observed defect in an unattempted recording or playback operation.

| Requested verdict | Result |
| --- | --- |
| HOSTED TEACHER AUDIO | **FAIL — complete acceptance not established:** real Student reception and playing audio proved, owner audibility answer not received |
| HOSTED SCREEN CAPTURE | **FAIL — blocked before stage A:** chooser/capture not attempted before the original cutoff |
| STUDENT RECEIVED SCREEN | **FAIL — not attempted** |
| OWNER READABILITY CONFIRMATION | **NOT CONFIRMED** |
| NEW HOSTED RECORDING | **FAIL — not attempted** |
| R2 UPLOAD + VALIDATION | **FAIL — not attempted**; credential/list/HEAD preflight passed |
| ADMIN REVIEW + PUBLICATION | **FAIL — no new recording to review** |
| STUDENT REPLAY | **FAIL — no new recording** |
| SEEKING | **FAIL — not attempted** |
| SIGNED-LINK RENEWAL | **NOT EXERCISED** |
| FINAL MEDIA CLEANUP | **PASS** — database rows terminal and both exact provider sessions HTTP 410 |
| PHYSICAL ANDROID | **NOT RUN** |
| PHYSICAL IPHONE | **NOT RUN** |
| PRODUCTION | **UNCHANGED** |

Class **`85ca9270-b360-4ae8-bf58-14d2ac566d4e`**, `Synthetic ALS Hosted Lesson and Replay Acceptance — 1 Oct 2026`, is **completed**. Recording ID, duration, object size and final recording publication state: **none — no recording created**. Multipart part count: **0**. Final active/reconnecting connections, active/closing publications, active/closing subscriptions, open attendance and pending recording/upload segments: **0 / 0 / 0 / 0 / 0**. Exact provider sessions: **0 active**, explicitly expired. Normal Teacher End acceptance is **not proved**.

## Why the acceptance stopped

The deployment setup used the wrong Hostinger output-directory setting, `.next/standalone`. The application compiled, but Hostinger then reported **“Next.js build produced no standalone server or static output”**. The accepted `.next` setting was restored and redeployment succeeded using the existing accepted source files. The correction consumed most of the original bounded window. The window was not extended.

Teacher audio was genuinely published and received, but the owner audibility question remained unanswered. Less than 60 seconds remained by the time transport evidence was collected, so the required 60–120-second recording could not fit. No screen-share chooser was opened and no recording was started. An attempted normal Teacher End click found no control because the cutoff had already removed the classroom. Scheduled expiry and cleanup completed the class instead. The earlier commentary expressed an intended normal ending; it is not evidence that the action succeeded.

Only one fresh class was created. No completed class was reused, no second window/class was started, and no abandonment scenario or long recording was manufactured. The full Step 3 acceptance remains incomplete.

## Prerequisites and preparation

- Protected existing Hostinger staging; unchanged Supabase project **`slghshcdaijbcjfoqerq`**, verified name/organization and healthy status through the existing authorized management path. The MCP SQL connector reported insufficient permission; its access was not expanded.
- SFU **`6306f9d5f836a1aa08b0d6bbde22f10b`**, `als-staging-sfu-containment-20261001`; TURN **`19951d8aa17f40210ffc756ba8c1ba3a`**, `als-staging-turn-containment-20261001`. No credentials rotated.
- At **13:02:10.536 UTC**, R2 replacement list/HEAD returned 200; existing private bucket `als-live-poc-recordings` held **5 objects / 373,259,206 bytes**. Conservative credential guard **2026-10-08T00:00:00Z** valid. No new recording object or test object was uploaded.
- Existing inert SFU session inspection returned explicit 410; replacement TURN short-lived generation returned 201, TTL 60 seconds. Generated credentials were not emitted or retained.
- Cloudflare billable usage showed **0.3 GB / first 1,000 GB included** Realtime, **2.1 GB-months / first 10 included** R2 storage, 523 Class A operations and 795 Class B operations, both within included limits; displayed cost $0.00. These are dashboard observations, not a guarantee against delayed usage reporting.
- At **13:03:39.949468 UTC**, all active media categories were zero; job 1 paused, 46 migrations retained. The existing protected cleanup route authenticated its separate Vault dependency and returned HTTP 200 with zero candidates/provider calls/row changes.
- Genuine synthetic Admin signed in through the hosted UI and scheduled the class at **13:07:28.769467 UTC**, recording allowed, expected receivers 1, valid existing Teacher/Program/Subject/active Batch. Primary Student 1 was eligible. Teacher and Student loaded the restricted room while media was disabled. Hosted live/recording/POC flags were privately observed false before the opening deployment.
- Prepared owner-controllable Chrome teaching tab: large title, specimen → quality → result diagram, SLIDE A and SLIDE B controls; no private data. The owner replied **“Ready with headphones.”** Camera and Student publishing remained off.

## Operational evidence — UTC

| Time | Evidence |
| --- | --- |
| 13:22:21 | First configuration deployment submitted, original operational window **13:24:56.739–13:34:56.739** |
| 13:24 | Deployment **`01a0f7a1-5756-729c-b842-be8079fb8059`** failed at output discovery after successful compilation |
| 13:24:09.392 | Existing cron job 1 resumed; schedule/endpoint/Vault dependency unchanged |
| 13:28:55.681 | Corrected `.next` deployment submitted; same original bounds and credentials |
| 13:30:41.012162 | Fresh class still scheduled; all media counts zero |
| 13:31:45.765 | Corrected deployment **`01a0f7a7-6146-7068-8208-3ad177e155d0`** visibly Completed/Current |
| 13:32 | Teacher normal Start succeeded; normal Teacher and receive-only Student Join controls used |
| 13:32:39.835344 | Teacher attendance opened; Student attendance opened at 13:32:40.388976 |
| 13:33 | Teacher Connected/Microphone on; Student audio element unpaused/unmuted, readyState 4, currentTime 11.406879 |
| 13:34:09.839361 | DB: one actual microphone publication, one matching Student subscription; Student microphone RX **128,693 bytes**, TX 0; Teacher microphone TX **225,105 bytes** |
| 13:34:10.174 | Exact SFU publisher and receiver sessions GET 200; matching local/remote microphone track MID 0 active |
| 13:34:56.739 | Original hard cutoff; no screen or recording had begun |
| 13:35:00.248 | Scheduled class completion persisted; microphone publication terminal at 13:35:00.961 |
| 13:35:03.434 / .446 | Student/Teacher attendance closed with reason `left` |
| 13:35:12.551 | Both database connections terminal closed; subscription closed, no retries pending |
| 13:36:02.392 | Both exact provider sessions explicitly HTTP 410 / `session_error` |
| 13:37:51.213 | Cron job 1 paused again |
| 13:39:56.695 | Disabled configuration restoration submitted |
| 13:42:51.939370 | All five active database categories zero; no recording/segment/part rows; cron paused |
| 13:42:52.251 | Both exact provider sessions still HTTP 410 |
| 13:44:59.653 | Final completed deployment privately read back: all 25 expected values matched; live/recording/POC false; original expired operational bounds and credentials restored |

Teacher connection **`51bda9af-5872-49aa-a2b7-ec1b1d71f481`**, publisher session **`9e7fe9afc4e6f6e28de8c22a0da15e62fce910ba292d02128715b8dae244ee5c`**. Student connection **`f6082993-0c94-48f4-9f26-8fb3e9069e9c`**, receiver session **`7fbc48f013a708e953fa182dac7ac6daf0551ebd64da18b969f74af9d31abc54`**. Publication **`da77d778-fc72-4f4d-a3e5-48ec73d670b5`**, subscription **`4433d30f-7405-48a5-9e40-705fa3c96443`**, MID 0. Final persisted Student microphone RX **608,670 bytes**, TX 0; Teacher microphone TX **704,981 bytes**. Screen/camera counters zero. Owner audibility confirmation was not received, so full audio acceptance is not marked PASS.

Scheduled runs/requests **47–59** occurred while cron was enabled. **Run/request 57 at 13:35** reports SQL succeeded but its HTTP response **timed out**; it is not counted as successful HTTP proof. Direct subsequent DB/provider inspections establish terminal closure independently. Runs/requests 58 and 59 returned HTTP 200 with quiet-state results. No manual cleanup POST during the live run and no manual provider close were used. Final closure does not satisfy the requested normal Teacher End workflow.

## Final safety and preservation

Final Hostinger deployment **`01a0f7b1-7819-7263-89b5-a972fcbe7a04`**, Completed/Current. All 25 values privately matched the preserved baseline. R2, Supabase and new SFU/TURN replacement credentials unchanged. Anonymous root returned 307 to `/_staging-access`. Teacher/Student/Admin acceptance contexts and the harmless teaching tab were closed; browser inventory showed zero classroom/playback pages. The task-owned local teaching server was stopped.

All **22 academic fixture/authorization checks passed** after cleanup. Watch history retained **44.013 seconds**; existing submitted test results and academic content unchanged. Five original primary enrollment IDs/program rows/status/start were retained; exact expiry **2026-10-08T07:40:22.181Z**, start **2026-10-01T07:40:22.181Z**, freshly checked at 13:46:11.307549 UTC. 46 migrations retained. The unrelated scheduled fixture matched its historical row; Step 2 class/evidence remained completed and unchanged. No application source/schema, Production, payment, certificate, subscription/billing plan, credential or hosting-resource change. No Git push.

Safe evidence: [provider headroom](evidence/als-step3-20261001/provider-headroom.png), [prepared disabled Teacher room](evidence/als-step3-20261001/teacher-prepared-disabled.png), [harmless SLIDE A](evidence/als-step3-20261001/teaching-slide-a.png), [class ended](evidence/als-step3-20261001/class-ended.png), [final completed deployment](evidence/als-step3-20261001/final-disabled-deployment.png). Detailed non-secret observations are retained under ignored `.local-qa/step3/`; secret values and signed URLs are excluded from reports and screenshots.
