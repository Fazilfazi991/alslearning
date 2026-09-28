# ALS hosted classroom closeout — 28 September 2026

## Scope and release identity

- Isolated environment: existing Hostinger ALS staging app at `https://darkgreen-camel-484366.hostingersite.com/`, Supabase project `als-live-staging` (`slghshcdaijbcjfoqerq`), existing Cloudflare SFU/TURN and private R2 bucket. Production was not changed.
- Source: branch `codex/hostinger-staging`, commit `8cc649a58b6145ccd62600024bbf0fa4ba09c29b`. The allowlisted source ZIP SHA-256 was `4e2a0b26165871e8355b4c022991841f338ae828c0a3188a60e3f2d6144cacf9`. Deployment `01a0e6f6-e8ac-732e-86e4-767a28567673` installed the candidate. Configuration-only deployment `01a0e723-aeaa-722d-a6db-0a069bd7501b` enabled the bounded test window. Final configuration-only deployment `01a0e753-3daf-704a-84ce-3929937530eb` is Completed/Current with the same source ZIP and live entry/recording flags disabled.
- Local candidate verification: 260 Vitest tests passed (13 skipped), four Node tests passed, ESLint, TypeScript, and Next.js 16.3.3 Webpack production build passed. Local results do not stand in for hosted browser results.
- Team: coordinator `/root` integrated/deployed and owned backend acceptance; `/root/browser_access` alone operated shared Chrome and hosted consoles; `/root/live_media` owned transport investigation; `/root/recording_playback` owned recording/playback investigation. Runtime concurrency allowed three specialist agents at a time, so the coordinator handled the fourth role.

## Acceptance matrix

Each hosted PASS below refers to the staging environment and source commit above. “Open” means the gate has no sufficient hosted proof.

| Gate | Verdict | Concrete evidence / remaining condition |
| --- | --- | --- |
| Deployed revision and protected access | **PASS** | Existing Hostinger app used the checked ZIP; candidate, activation, and safe-state deployments completed. Teacher and Student used separate normal authenticated staging contexts. The final Teacher page explicitly reports live entry disabled and has disabled Join/recording controls. |
| Teacher/Student session isolation | **PASS** | First class `00f08a3b-1329-496e-95db-0a48dbb8fda3`: Teacher connection had a publisher provider session only; Student had a distinct receiver provider session only. No Student microphone publication. |
| Student join | **PASS** | Student1 joined the first restricted hosted class through its UI at about 08:41 UTC. The second class `9c76d034-2d91-45d0-838e-6a5235036ec9` also had a distinct Student receiver and subscription. |
| Teacher audio received by Student | **PASS** | First class: Teacher mic TX about 61–64 kbps, Student RX about 63–64 kbps and TX 0; active Student microphone subscription and repeated Student `received_microphone_bytes` increments of about 475–482 KB/min. Closed usage rows preserve positive receive bytes. Second class repeated positive RX. |
| Browser audio playback | **PASS, browser state only** | Student remote audio element was unmuted, unpaused, readyState 4, and `currentTime` advanced to about 223 seconds. Human hearing was **not confirmed**. |
| Human audibility | **Open** | Requires owner or other human listener confirmation; network and element state cannot establish audible output. |
| Actual teaching-screen reception/readability | **Open** | Chrome’s native screen chooser could not be completed by the available browser operator. Teacher screen TX stayed 0, Student showed “Waiting for teaching visuals”, and Student screen receive bytes were 0. No decoded teaching frames or readability proof. |
| Optional camera | **Not run** | No working authorized camera was available. |
| Grant/revoke, participant removal, reconnect | **Not run** | No hosted end-to-end exercise. Local authorization and cleanup tests do not establish hosted behavior. |
| Incremental hash Worker execution | **Not run hosted** | No hosted recording entered integrity validation; the browser did not request a Worker asset. Local compiled asset and local hash tests do not establish hosted Worker execution or digest. |
| Hosted R2 multipart upload, interruption/recovery, post-class completion | **Not run** | No hosted recording segment or recording row was created. Scoped R2 authentication, exact-origin CORS, and private-object HEAD passed separately; these do not prove the application’s hosted upload. The prior local post-class completion remains local evidence only. |
| Genuine Admin publication and eligible Student replay | **Not run** | No staging recording reached review or publication. |
| Seek and automatic signed-link renewal | **Not run hosted** | Candidate includes a tested fix that restores playing/paused state on renewal. No hosted playback object was available. |
| Saved 337,011,409-byte long-file validation | **Not run hosted** | Prior local recording/R2 evidence was retained; there is no staging manifest for this object. No repeat two-hour capture occurred. |
| Wrong-role/class and unpublished-content denials | **Open** | Server authorization checks and local tests exist; complete hosted negative-path suite was not executed. |
| Unattended cleanup scheduling | **PASS for invocation; mutation unproven** | Staging `pg_cron` called the guarded Hostinger cleanup endpoint without a browser/local script. Scheduled `pg_net` responses were HTTP 200, including runs that inspected the second class. Those responses reported zero candidates/closures, so a scheduled state mutation is unproven. The unauthenticated POST returned 404; authorized manual POST returned 200. Staging-only `service_role` SELECT/UPDATE grants on the five cleanup tables were verified, with RLS retained. |
| Physical Android Chrome | **Not run** | Requires owner-operated device session. |
| Physical iPhone Safari | **Not run** | Requires owner-operated device session, including actual codec/seek/renewal behavior. |
| Final resource and feature state | **PASS for inspected rows/configuration** | Both synthetic classes are `completed`; both sets of connections closed or stale, publications/subscriptions closed with provider reconciliation outcomes and no pending retry; attendance ended. No segment or recording row was created. Final deployment is Current with live entry and recording disabled. |

## Bounded run and operational notes

- First audio run ended 08:48:36 UTC. The second class ended 09:13:47 UTC. The second Teacher connection lasted about 10 minutes 47 seconds while the native screen chooser stalled, exceeding the requested 10-minute per-run target by about 47 seconds. Total active live time remained below 30 minutes. No further live session was started.
- Fresh Cloudflare billing view showed $0 observed cost; private R2 bucket had five objects totaling about 373.26 MB. The existing scoped R2 token remained valid through 1 October 2026 and was not renewed. No paid upgrade or new provider was used.
- A staging-only bearer-protected cleanup endpoint and one-minute Supabase cron/Vault invocation were configured. Job 1, `als-live-staging-cleanup`, was paused with `active=false` after final inspection; run history remains. An HTTP 200 proves invocation, not successful mutation when no candidate exists.
- No push, merge, production enablement, or alternate Cloudflare Workers deployment occurred. Existing unrelated local changes to `docs/HOSTINGER-STAGING-DEPLOYMENT.md` were preserved.

## Verdict and next owner session

- **HOSTED SOFTWARE ACCEPTANCE: PARTIAL** — Student microphone reception is now proven; screen reception, the hosted recording/playback chain, and several access/reconnect gates remain open.
- **PHYSICAL-DEVICE ACCEPTANCE: NOT RUN**.
- **CONTROLLED PILOT READINESS: NOT READY**.
- **PRODUCTION ENABLEMENT: NOT ENABLED**.

The next bounded owner session should complete the browser’s native screen-share chooser, confirm human audibility and Student frame readability, then run one short Teacher recording through Admin publication and Student playback. Separately, use real Android Chrome and iPhone Safari on the protected staging site to check receive-only join, audio, teaching visuals, seek, and signed-link renewal. Reopen a new bounded staging window deliberately; the 28 September window has ended and live flags are disabled.
