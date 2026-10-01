# Step 3 retry — preparation checkpoint

Historical preparation checkpoint at 2026-10-01 14:13 UTC (18:13 Asia/Dubai). Final update 18:21 UTC / 22:21 Dubai: see [retry acceptance evidence](ALS-STAGING-STEP3-RETRY-ACCEPTANCE-2026-10-01.md). The separately approved recording-lifecycle fix is deployed as `01a0f8a7-6338-7357-b6db-cbb8ad5d1ac1`, source `71be353bec8ceca79e1120b614a83869c199fb97`. The exact retained recording is normally Admin-approved and published; eligible Student replay, seeking, renewal and expired-account denial passed. Entry flags remain false, cron paused, database active media categories zero, and exact provider sessions return 410. No additional class/window or credential/resource/academic/expiry change occurred. **Normal Teacher End remains FAIL/UNVERIFIED.** The local teaching server and live-test contexts are closed; a non-media Hostinger settings tab could not be closed because its debugger was unattached. Do not execute the historical preparation steps below again or create another class.

## Preserved baseline

- Accepted application source remains unchanged; no Git push or Production change.
- Current safe Hostinger deployment: `01a0f7b1-7819-7263-89b5-a972fcbe7a04`.
- Hostinger's 25 staging configuration values privately matched the accepted baseline; Output directory is `.next`.
- Live, recording and POC flags remain false. No new operational window has been submitted.
- Existing staging cleanup cron job 1 remains paused.
- Replacement SFU: `als-staging-sfu-containment-20261001`, `6306f9d5f836a1aa08b0d6bbde22f10b`.
- Replacement TURN: `als-staging-turn-containment-20261001`, `19951d8aa17f40210ffc756ba8c1ba3a`.
- R2 bucket remains `als-live-poc-recordings`; credential guard remains 2026-10-08T00:00:00Z. Supabase project remains `slghshcdaijbcjfoqerq`.

## Fresh class and sessions

- Class: `7385751c-3640-4db3-9a45-5348e682cffe`, **Synthetic ALS Screen Recording Replay Retry — 1 Oct 2026**.
- Created through genuine Admin scheduling at 14:09:43.686175 UTC.
- Scheduled 14:20–14:40 UTC / 18:20–18:40 Dubai. Status scheduled; recording allowed; expected receiver count 1; Student microphone/camera disabled.
- Verified assigned Teacher and known-good Synthetic Laboratory Science / Synthetic ALS Staging Classroom / Synthetic Staging Batch scope.
- Teacher Chrome tab `2073612353` and separate Student Chrome tab `2073612354` are authenticated on this exact class; both display the disabled classroom gate.
- Genuine Admin IAB tab `7` is authenticated at `/admin/live-classes`.
- Teacher Chrome teaching tab `2073612357` is **ALS SCREEN ACCEPTANCE**, served harmlessly at `http://127.0.0.1:47831/` with SLIDE A/B controls. Task-owned local teaching server session: `29232`.
- Hostinger Chrome tab `2073612358` is on Settings and redeploy. No settings were changed or submitted.

## Evidence

- Provider/storage preflight at 14:02:51.712 UTC passed: exact replacement SFU authenticated terminal-session response 410, TURN short-lived credential generation 201 (TTL 60), R2 List/HEAD 200. No credential values were output.
- Quiet database state at 14:02:54.764582 UTC: zero live classes, open/reconnecting/unresolved connections, active/closing publications/subscriptions, open attendance and recording/upload/interrupted segments. Cron paused; 46 migrations. Existing protected cleanup endpoint returned 200 with zero candidates and zero changes.
- All 22 academic fixture/authorization checks passed. Watch history remains 44.013 seconds. Five enrollment rows retain starts 2026-10-01T07:40:22.181Z and expiry 2026-10-08T07:40:22.181Z.
- Safe screenshot: `evidence/als-step3-retry-20261001/teaching-prepared.png`.
- Ignored retry evidence/helpers: `.local-qa/step3-retry/`. Existing Step 2 and previous Step 3 evidence were not overwritten.

## Resume

1. Obtain owner readiness for headphones and physical Teacher/native-chooser controls before enabling media.
2. If owner readiness arrives after the scheduled class interval becomes unsuitable, adjust this same fresh, unused class through normal Admin schedule controls; do not create another class.
3. Submit configuration-only staging redeploy using previous accepted files and `.next`; use a future operational start with sufficient build margin and a maximum 20-minute interval. If deployment is not Current/Completed before that start, keep entry closed and correct the bounds before any class starts. Verify all preserved values and exact flags/bounds privately, then reload prepared sessions before starting the timed class.
4. Target live media 3–5 minutes, hard maximum 10. Record distinct transport and owner audio/readability verdicts. Owner must choose only ALS SCREEN ACCEPTANCE in Chrome Tab sharing.
5. Complete stages A–H, 60–120-second recording with spoken Marker A/B, normal Teacher End, upload/hash validation, genuine Admin playback review/publish, Student replay/seek/renewal and ineligible replay denial.
6. Restore live/recording false, pause cron, verify zero active resources and no pending recovery/upload loops, preserve successful recording and academic state, close acceptance contexts and stop the task-owned teaching server.

Previous Step 3 is a closed incomplete attempt: audio reception was technically verified, but screen capture/recording did not run because the operational window was consumed by deployment correction. It is not evidence of functional screen-share or recording failure. Do not rewrite media code based on that attempt.
