# ALS Step 4 — normal Teacher End class acceptance

Completed 3 October 2026. Final database observation: **04:07:28.018952 UTC / 08:07:28.018952 Asia/Dubai**. Only this test was run. One fresh synthetic class was created; no application source, recording workflow, credential, academic fixture, enrollment expiry, Production or Git remote was changed. No Git push occurred.

**Normal Teacher End, database closure and actual provider closure passed. Overall Step 4 acceptance remains incomplete because the Student page did not automatically render the ended state or remove Join. A normal page refresh corrected the display.** No fix was implemented in this test-only task.

## Requested verdicts

| Requirement | Verdict |
| --- | --- |
| NORMAL TEACHER END | **PASS** |
| STUDENT ENDED STATE | **FAIL** — automatic state remained stale; refresh showed ended and removed Join |
| NORMAL DB CLOSURE | **PASS** |
| NORMAL PROVIDER CLOSURE | **PASS** |
| CRON CAUSED CLOSURE | **NO** |
| FINAL MEDIA STATE | **SAFE** |
| ACADEMIC REGRESSION | **PASS** |
| PHYSICAL ANDROID | **NOT RUN** |
| PHYSICAL IPHONE | **NOT RUN** |
| PRODUCTION | **UNCHANGED** |

## Class and preparation

- Class: **`f7f352cb-7af7-4c69-843f-881edd6459c2`**, **Synthetic ALS Normal Teacher End — 3 Oct 2026**.
- Created through genuine Admin scheduling at **03:49:00.660471 UTC**. Existing assigned Teacher and eligible Student 1 signed in through the normal staging gate and login UI.
- Teacher: `0e6466ff-3aeb-4db0-b792-b568ec3edc47`; Student 1: `7098162f-9337-4db6-8bef-e3eaeedd7045`.
- Program `66106212-52d7-4c4b-9e62-db3534bfe011` (**Synthetic ALS Staging Classroom**), Subject `5579ddb6-6cba-4d95-bc15-e2be3d617f6d` (**Synthetic Laboratory Science**), Batch `fe5b1e6c-0ade-4fdc-a914-5c8d3fa1e8e3` (**Synthetic Staging Batch**).
- Recording **OFF**, camera **OFF**, Student microphone/video publishing **OFF**, expected receivers **1**. No screen share or recording was started.
- Teacher used Chrome; Student used the separate in-app browser cookie context. Both exact classroom pages were authenticated and prepared before the media window.
- Read-only preflight **03:46:08.021255 UTC** and before-start inspection **03:56:41.055572 UTC**: zero live classes, open/reconnecting/unresolved connections, active/closing publications/subscriptions, open attendance and pending recording/upload/interrupted segments. Cleanup cron job 1 was inactive, with zero running jobs.
- Replacement SFU access succeeded against the existing terminal verification session (410 / `session_error`), and the existing replacement TURN key generated a 60-second credential (201). Secret values and generated credentials were not retained in public evidence.

## Bounded staging configuration

Outer operational window: **03:57–04:07 UTC / 07:57–08:07 Dubai**, exactly ten minutes.

Only `ALS_LIVE_CLASS_ENABLED`, `ALS_STAGING_TEST_START_UTC`, and `ALS_STAGING_TEST_CUTOFF_UTC` were temporarily changed in the existing Hostinger staging app. Recording and POC entry stayed false throughout. All 25 environment values were privately compared; credentials and other values were unchanged. The designated ignored local configuration remained unchanged. Its historical expired-window bounds differed from the hosted baseline; only those known non-secret historical bounds differed.

- Accepted source: **`71be353bec8ceca79e1120b614a83869c199fb97`**.
- Accepted source ZIP SHA-256: **`e4e19cc77e6d0e0fca862bd02d5c0099d6283dafe3ad5526d6c689b409537828`**.
- Enabled configuration deployment: **`01a0ffe3-4dff-73d2-bd70-2cfd3b063647`**, from **previous deployment source**, submitted **03:51:21 UTC**, Current/Completed before the window (displayed deployed 07:53 Dubai; recorded completion observation **03:54:31.924 UTC**).
- All 25 deployed settings matched the expected configuration at **03:55:20.451 UTC**. Both prepared sessions were reloaded after deployment completion, and again after the window opened before Start.
- Framework Next.js, Node 22.x, output `.next`; accepted source files reused. Hostinger compilation, type checking and deployment completed. No dependency or product-source change was made in this task.

## Real reception and normal End action

Teacher clicked **Start class** at **03:57:24.883 UTC**; server status became live at **03:57:27.047 UTC**. Teacher enabled the actual microphone through the normal UI and joined at click invocation **03:58:16.231 UTC**. Student joined receive-only at invocation **03:58:17.327 UTC**.

Real microphone publication and matching Student subscription were established in the replacement SFU. Exact provider inspection at **03:58:41.205 UTC** returned 200 with active local Teacher MID 0 and active remote Student MID 0, referencing the same ALS publication. Student native audio at **03:59:31.745 UTC** was unpaused/unmuted, readyState 4, currentTime **57.449095**; its visible technical details showed microphone **RX 64 / TX 0 kbps**, camera/screen zero.

Persisted Student microphone RX increased **337,145 → 754,792 bytes** between **03:59:52.007484** and **04:00:32.384088 UTC**. Student microphone TX was zero; both roles' camera and screen TX/RX counters were zero. Teacher microphone TX reached **796,349 bytes**. There was one publication and one subscription, two active connections and two attendance intervals immediately before End, with no pending capture/upload work.

Teacher clicked the visible normal **End class for everyone** control. No direct control API invocation, manual cleanup call, SQL row mutation, or cron activation was used.

| Event | Exact UTC timestamp, 3 October 2026 | Dubai time |
| --- | --- | --- |
| End UI click invocation | **04:00:46.526Z** | **08:00:46.526** |
| UI click call returned | 04:00:47.867Z | 08:00:47.867 |
| Class `completed` / `ended_at` | **04:00:47.489Z** | **08:00:47.489** |
| Both attendance intervals ended, reason `ended` | **04:00:47.489Z** | **08:00:47.489** |
| Microphone publication closed, `confirmed_closed` | **04:00:48.006Z** | **08:00:48.006** |
| Student subscription closed | **04:00:48.682Z** | **08:00:48.682** |
| Both connections' final `closed_at` | **04:00:49.188Z** | **08:00:49.188** |
| Read-only post-End DB observation | 04:00:59.123043Z | 08:00:59.123043 |
| Exact terminal provider inspection started | 04:01:01.257Z | 08:01:01.257 |

The click timestamp records the automation invocation of the normal visible button; a separate network request-start timestamp was not captured. Server `ended_at` occurred within the recorded click invocation/return interval. Teacher showed **This class has ended.**, with no Join control, without a page reload.

End was **6 minutes 13.474 seconds before** the operational cutoff, **54.519 seconds after the first persisted positive Student RX sample**. The intended 60–90-second class duration was exceeded: server live duration **200.442 seconds** (3m20s), microphone publication duration **139.252 seconds** (2m19s). Preparation inside the started classroom and evidence collection contributed to that deviation. It is preserved as a timing deviation; it did not overlap the cutoff or allow cron to cause closure.

## Exact database and provider resources

| Resource | Non-secret ID | Terminal result |
| --- | --- | --- |
| Teacher connection | `3f47257d-ffbb-4e42-8cf3-ebb0805f332c` | closed |
| Student connection | `c227af6f-cf80-4191-878c-f585282a0be5` | closed |
| Teacher microphone publication | `32edd7a0-0c05-454a-8507-6ee96d5849c6` | closed / confirmed_closed |
| Student subscription | `d6632fea-5a4e-4386-8ee2-a53bd3ac335e` | closed |
| Teacher attendance | `a840b9fd-357a-40b2-a3af-ce1bebf87070` | ended |
| Student attendance | `f3a909d8-8375-4e65-8e5b-6ed5870e3f89` | ended |

SFU app **`6306f9d5f836a1aa08b0d6bbde22f10b`**, **als-staging-sfu-containment-20261001**, unchanged. TURN key ID **`19951d8aa17f40210ffc756ba8c1ba3a`**, **als-staging-turn-containment-20261001**, unchanged.

- Exact Teacher publisher session **`c7577bad4f3d0b8be3f67115c2d2f101a8fe0f6937564c0193404107cff23188`**: **410 / session_error**, terminal/absent.
- Exact Student receiver session **`c590b85f93a4147023ef391510768de309185eb45d9c56d4f72abad7c3f149c3`**: **410 / session_error**, terminal/absent.
- Both terminal results were saved by approximately **04:01:11 UTC**. No active provider media remained for this class. No provider-close request was manually issued outside the application's normal End workflow.

## Cron attribution

Cleanup job **1 / als-live-staging-cleanup** remained **paused** throughout preparation, reception, End and final verification. Its history was identical before and after: maximum run ID **72**, last start **2026-10-01T14:39:00.025104Z**, last end **2026-10-01T14:39:00.040493Z**, zero running jobs. There was no Step 4 cleanup run ID. The internal cleanup endpoint was not called, including for a zero-candidate check.

Normal End's application route first completed the class/attendance/connections and then reconciled transport. The observed publication/subscription closure followed the End click and preceded the final quiet inspection. Existing normal client lifecycle/reconciliation behavior was left intact. **Cron did not cause these transitions.** No safety fallback cleanup was necessary.

## Student automatic ended-state failure

At **04:01:22.824 UTC**, Teacher was already on the ended screen. Student media had stopped and the page displayed **The class is not live**, but it still showed a **Live** badge and an enabled **Join classroom** button. At **04:02:15.830 UTC**, 88 seconds after server completion, the Student still had no ended heading, one enabled Join control, and zero audio elements. This fails the requested automatic ended-state/Join-removal acceptance.

A normal page refresh showed **This class has ended.**; at **04:02:41.908 UTC**, ended-heading count was one, Join count zero, and audio count zero. Refresh success does not turn the preceding automatic-state failure into PASS.

Read-only source investigation identified a likely cause: `NativeClassroom` initializes `classStatus` from the original session, and updates it for the local lifecycle action; the Student context does not perform that action. Its realtime subscriptions cover messages, participants, polls and published tracks, but not session completion. This is an inference from source plus observed UI behavior, not a newly implemented fix. A future fix should update the Student's canonical class status and suppress rejoin after an authoritative completed response. No code or recording behavior was changed here.

## Academic and recording preservation

**21 read-only academic checks passed**, covering both eligible Students' program/enrollment IDs, published-material visibility, hidden draft/answer keys, canonical subject mappings, Teacher question/material/assessment scope, server-graded result/history, date-aware Student assessment catalogue, expired/unenrolled denials, and unassigned Teacher row visibility. No authoring mutation test or fixture reseed was performed.

The legacy October 1 verification expected an upcoming assessment. By October 3 that assessment was correctly available. The ignored read-only helper was made date-aware against the existing test dates; the draft assessment remained hidden. Academic rows were not edited to satisfy the verification.

Final preservation evidence exactly matched the before-test snapshot:

- Five enrollment rows/IDs/programs/batches/statuses unchanged; starts **2026-10-01T07:40:22.181Z**, expiry **2026-10-08T07:40:22.181Z**.
- Student watch history **44.013 seconds**, 46 migrations, existing graded results retained.
- Step 3 recording **`ea83d954-a4ef-45b6-b34c-8b80722f3b04`** remains `published`, **184.958 seconds / 4,451,838 bytes**, original verification/publication timestamps unchanged.
- Original segment **`5d65817a-2a15-4013-9504-f81f8ece728c`** remains `ready`, original class/Teacher ownership, digest and bytes unchanged.
- Total recording rows **2 → 2**, total segments **2 → 2**; **zero new recordings or segments**.
- R2, Supabase, SFU and TURN credentials unchanged; no Production change.

## Final safe state and deployment

Restoration submitted **04:02:43.369 UTC**, using the same previously accepted files. Final Hostinger deployment **`01a0ffed-bf02-7239-b3e7-77b899ef3039`** is **Current/Completed**, displayed deployed **08:04 Dubai / 04:04 UTC**. Completion was observed **04:05:59.556 UTC**, and private readback **04:06:36.698 UTC** confirmed all **25 original baseline values exactly**, including unchanged credentials and restored original expired operational bounds.

`ALS_LIVE_CLASS_ENABLED=false`, `ALS_LIVE_RECORDING_ENABLED=false`, `ALS_LIVE_POC_ENABLED=false`. Final DB inspection **04:07:28.018952 UTC** found zero live classes, open/reconnecting/unresolved connections, active/closing publications/subscriptions, open attendance, and pending capture/upload/interrupted segments; cron remained paused with no new history. All task-owned Teacher, Student and Hostinger tabs were closed. No pending recording/recovery loop or teaching server was created for this task.

## Evidence

Safe screenshots: [Teacher ended](evidence/als-step4-normal-end-20261003/teacher-ended.png), [Student stale state before refresh](evidence/als-step4-normal-end-20261003/student-stale-after-end.png), [Student ended after refresh](evidence/als-step4-normal-end-20261003/student-refreshed-ended.png), [completed live-only deployment](evidence/als-step4-normal-end-20261003/live-only-deployment-completed.png), [completed final disabled deployment](evidence/als-step4-normal-end-20261003/final-disabled-deployment.png).

Machine-readable non-secret evidence is saved alongside those images: `acceptance.json`, `baseline.json`, `before-start.json`, `reception-2.json`, `before-end.json`, `after-end.json`, `provider-preflight.json`, `provider-live.json`, `provider-terminal.json`, `end-action.json`, `student-stale-after-end.json`, `student-refreshed-ended.json`, `deployment-enabled.json`, `deployment-disabled.json`, `academic-final.json` and `final-safe.json`. Evidence consistency/preservation checks passed. Ignored helpers remain under `.local-qa/step4-normal-end-20261003/`.

**Stop after this test.** Step 3's historical normal-End verdict remains unchanged in its original report. This new class proves the normal Teacher End/resource-closure gate; the Student automatic ended-state gate remains failed.
