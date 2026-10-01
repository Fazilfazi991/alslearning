# ALS Step 2 — unattended shutdown acceptance, 1 October 2026

## Final acceptance — PASS, 1 October 2026

| Check | Verdict |
| --- | --- |
| Provider credential preflight | **VALID** — replacements verified; exact old resources rejected with HTTP 404 |
| Real Teacher microphone provider resource | **CREATED** — replacement app GET HTTP 200, MID 0 active |
| Browser-abandonment fixture | **CREATED** — Teacher tab destroyed; no Leave/End; no classroom page remained |
| Scheduled database cleanup | **PASS** |
| Actual Cloudflare provider-resource cleanup | **PASS — explicitly absent/expired** |
| Healthy-resource isolation | **PASS — unrelated scheduled fixture unchanged** |
| Final staging state | **SAFE** — zero active media, cron paused, live/POC/recording disabled |
| Production | **UNCHANGED** |

### Exact resources

- Class: **`92cd68dd-549a-4e71-9dad-5f85d2197245`**, `Synthetic ALS Scheduled Shutdown Acceptance — 1 Oct 2026`.
- Replacement SFU app: **`6306f9d5f836a1aa08b0d6bbde22f10b`**, `als-staging-sfu-containment-20261001`.
- Connection: **`ebc99826-f101-40a8-ad4a-a95988e94319`**.
- Publisher provider session: **`e16593057fce31611e0bc924e81363f16d20c483775121c224553ad7436b8d67`**.
- Microphone publication: **`63e0d663-2483-4161-ac85-50fa693355df`**, MID **`0`**.
- Attendance: **`1710585e-8367-4410-8a62-7363e7f87ba4`**.
- Subscriptions: **none**; this architecture required no Student receiver.
- Existing job **1**, `als-live-staging-cleanup`, unchanged every-minute schedule, endpoint and separate Vault token dependency. No second scheduler or manual cleanup POST.

### UTC timeline

| Time, 1 October 2026 | Evidence |
| --- | --- |
| 12:13:56.441892 | Quiet preflight: all active categories zero, cron paused |
| 12:19:45.974 | Exactly one fresh synthetic class scheduled using the existing Teacher/Program/Batch, recording off |
| 12:26:00.768 | Corrected only the fresh fixture to the existing permitted synthetic subject; no media yet |
| 12:30:05.822 | Teacher normal Start class control submitted; subsequently showed Live |
| 12:32:21.774 | Fresh fixture class/join window corrected to end 12:35:21.774, with zero connections as a write precondition |
| 12:32:38.190393 | Normal Teacher join created the connection; attendance opened at 12:32:38.322049 |
| 12:33:11.916223 | Actual microphone publication created; no camera/screen publication |
| 12:33:13.568988 | Exact replacement provider session GET HTTP 200; matching MID 0 / local microphone track active |
| 12:33:34.137 | Teacher tab destroyed without Leave or End; browser inventory showed zero classroom pages |
| 12:34:09.872346 | DB connection/publication active and attendance still open; heartbeat stopped at 12:33:24.934013. Provider already explicitly expired, HTTP 410 / `session_error` |
| 12:34:22.180 | Existing cron resumed |
| 12:35:00.146214 | Scheduled run 45 began; request 45 returned HTTP 200, no timeout, one stale candidate, one expired publication, zero failures |
| 12:35:01.750 | Publication terminal closed, `confirmed_absent_or_expired`, provider HTTP 410 / `session_error`, retry null, cleanup attempts 0 |
| 12:35:07.856 | Connection closed; attendance ended with reason **stale** |
| 12:36:00.060058 | Scheduled run 46 began; request 46 HTTP 200, no timeout; one expired class completed at 12:36:00.222 |
| 12:36:46.189 | Cron paused again |
| 12:40:37.245331 | Final guarded DB counts all zero, 46 migrations retained |
| 12:41:31.094 | Completed final deployment readback: live/POC/recording false, credentials unchanged |
| 12:42:46.634998 | Final exact session inspection still HTTP 410; closed DB rows and healthy fixture unchanged |

Scheduled run IDs and pg_net request IDs both **45 / 46**. Cron SQL run status `succeeded` alone was not treated as HTTP/provider success: the associated HTTP responses were independently inspected and returned 200 with the expected cleanup result. No unbounded retry remains pending. Publication-to-terminal reconciliation took about **110 seconds**; the microphone was active in the Teacher browser for about **22 seconds** before destruction.

### Provider proof and limits

The live provider GET matched the actual browser-created microphone publication by provider session and MID. After abandonment, Cloudflare automatically reported that exact session expired before cron resumed. The scheduled job then discovered the stale database candidate and recorded the provider's explicit terminal result. Final GET again returned HTTP 410 / `session_error`. No timeout was treated as absence. This passes the requested **closed OR explicitly absent/expired** check and proves scheduled reconciliation against the exact real resource. It does **not** prove that cron forcibly terminated a still-live SFU track; no such claim is made.

No manual provider close, manual cleanup POST, connection/publication/attendance row editing, normal Leave or End control was used for the acceptance or final cleanup. Class completion was scheduled. No classroom page could reconcile the lease after abandonment. The destroyed browser page cannot retain a microphone capture or PeerConnection; the ended Student view exposes no Join control.

Unrelated healthy fixture **`f92fdb1d-1c18-505c-a09d-a7b14ebe0daf`** retained the exact pretest row, including status and timing. Both pretest and posttest comparisons passed. No simultaneous second publisher was created; isolation evidence is limited to the permitted unrelated fixture.

### Setup corrections and retry evidence

The initial selected `Demo Laboratory Safety` subject was canonically visible to the Teacher but failed the classroom's `teacher_has_assignment(null, program, subject, null)` check; `can_join_live=false`, payload `PGRST116`, and the browser returned 404. The existing permission function requires its assignment exam scope to match the supplied exam; classroom callers supply null. The earlier successful `Synthetic Laboratory Science` subject passed the same check. Only this newly created synthetic fixture's subject was changed to that existing permitted scope; no assignment, permission, migration, accepted academic fixture or application source changed. The initial short window expired with **zero media** during diagnosis. One renewed 10-minute operational window was used; recording/POC remained disabled.

The Admin reschedule attempt did not persist the new times. After normal Teacher Start, before normal Join and before any connection existed, only the fresh synthetic class window was corrected through the existing authenticated Admin Data API. Normal Teacher Join/microphone publication followed; no connection/publication rows were manufactured. These setup paths are recorded and are not represented as successful Admin schedule-edit acceptance.

Existing focused tests refreshed: **11 tests in 3 files passed**, covering test-controlled exact transient `PGRST303`/future-JWT recovery, three-attempt exhaustion, no retry for unrelated auth errors, provider close/expiry handling and terminal normalization. No deployed credential tampering or manufactured live transient. Both actual scheduled HTTP runs succeeded without a retry. The SELECT retry does not replay writes/provider actions.

### Final handoff

Final Hostinger configuration deployment **`01a0f778-4b3f-71fb-8713-f555234cb137`**, accepted source/ZIP reused. All 25 values privately matched expected configuration, including unchanged R2/Supabase and replacement Cloudflare values; all three media flags false, operational cutoff already expired. Genuine Student portal restored; Teacher Live Classes shows unavailable entry. All 22 academic checks pass after acceptance; original five enrollment IDs/start/status, exact expiry **2026-10-08T07:40:22.181Z**, submitted results and **44.013 seconds** watch history preserved. No new attempt, playback, reset/reseed, schema change, source edit, production action or Git push.

Evidence: [real microphone publisher](evidence/als-shutdown-20261001/teacher-microphone-publication.png), [Student class ended](evidence/als-shutdown-20261001/student-class-ended.png), [final completed deployment](evidence/als-shutdown-20261001/hostinger-final-disabled.png). Non-secret raw observations/run/request metadata are retained in ignored `.local-qa/credential-step2/observe-*.json`; historical provider audit export remains intact. Secret-bearing pending capture was removed after consumer installation.

## Historical replacement checkpoint — 11:29 UTC

The later owner approval explicitly permits one replacement staging SFU app and TURN key, verified consumer installation, then deletion of the two exact old resources. Both replacements are created and provider-verified; the accepted Hostinger source completed configuration deployment `01a0f728-aa16-71a3-bf3c-1f80f55d6708`. All academic checks and genuine role sign-ins passed; R2, Supabase and exact Student expiry are unchanged.

Old-resource deletion is prepared but pending the browser policy's required **action-time confirmation for permanent deletion**. This confirmation was requested only after replacement checks passed. Containment is therefore incomplete, and Step 2 has not opened media or resumed cron. See the [current provider checkpoint](ALS-CLOUDFLARE-CONTAINMENT-2026-10-01.md).

Prepared acceptance tools privately inspect the exact replacement provider session, database state, existing job/run/request IDs and unchanged unrelated scheduled fixture. The unsubmitted synthetic Admin schedule uses the existing permitted Teacher/Program/Subject/Batch, one expected receiver and recording unchecked. No new class exists yet. Last scheduled run/request baseline: **44**; none is claimed as a new acceptance run.

Cleanup/retry evidence refreshed: **11 tests in 3 files passed** at 15:19 Dubai, including a test-controlled transient read recovery with a three-attempt bound. No credential tampering or live failure injection. Native browser destruction will be used rather than navigating away: normal React unmount can send a keepalive leave request, whereas abrupt tab destruction does not explicitly run the normal Leave/End controls. Database/provider evidence must still establish that scheduled cleanup processed a genuine stale connection; browser closure alone will not be counted as success.

At **2026-10-01T11:29:03.307765Z**, all active database media categories are zero, cron job 1 paused, all three media flags false, 46 migrations retained. No fresh media, abandonment, scheduled closure or provider isolation result is claimed. The earlier blocked preflight below remains historical.

## Later containment checkpoint

The owner subsequently approved in-place staging SFU/TURN containment. The [provider containment report](ALS-CLOUDFLARE-CONTAINMENT-2026-10-01.md) records verified consumers, current dashboard/API findings, fresh academic checks and the resulting resource-replacement approval boundary. No supported in-place secret replacement was found; no credentials/resources changed and Step 2 remains unproven. The original preflight observations below are retained as history.

## Focused result

**Stopped at provider credential preflight. No fresh class or media resource was created.** The owner's Step 2 instruction requires stopping when historical evidence establishes provider-secret exposure, rather than using the affected secret for a new media session.

The retained release-coordinator incident checkpoint records a full populated Hostinger environment form reaching tool output; `CF_REALTIME_APP_SECRET` and `CF_TURN_KEY_API_TOKEN` were present in that affected environment. The redacted manual-release report independently records secret-field values appearing in the Hostinger form snapshot. Both provider credentials are therefore treated as exposed for this test's preflight. No old secret-bearing tool output was reopened, replayed, searched for values or included here. The exact complete historical incident scope remains unknown; the earlier Step 1 inventory did not establish item-by-item exposure from safely inspectable reports alone.

The provider credentials were **not used for new sessions or media**, and no provider operation was performed after the exposure stop condition was established. Their current provider validity is **not tested**, which must not be confused with revocation or expiry. The separately contained R2 and Supabase credentials were not rotated again.

| Requested result | Verdict | Evidence / limit |
| --- | --- | --- |
| A. Provider credential preflight | **BLOCKED** | SFU app secret and TURN API token require a separate containment decision. |
| B. Real Teacher microphone provider resource | **BLOCKED** | No new session/publication. |
| C. Browser-abandonment fixture | **BLOCKED** | No fresh class or classroom browser was opened. |
| D. Scheduled database cleanup | **FAIL — acceptance not executed** | Cron remained paused; no scheduled Step 2 run. This is a blocked acceptance gate, not an observed cleanup failure. |
| E. Actual Cloudflare provider-resource cleanup | **UNPROVEN** | No fresh provider resource or reconciliation result. |
| F. Healthy-resource isolation | **FAIL — acceptance not executed** | No resource was acted on; isolation under cleanup was not exercised. |
| G. Final staging state | **SAFE** | Fresh quiet database check; live entry still unavailable; prior disabled flags unchanged. |
| H. Production | **UNCHANGED** | No production action. |

## Fresh quiet-state evidence

Read-only query of the independently guarded staging project `slghshcdaijbcjfoqerq` at **2026-10-01T10:37:25.792946Z**, or **1 October, 14:37:25.792946 Dubai**:

| State | Count/status |
| --- | --- |
| Live classes | 0 |
| Open/reconnecting media connections | 0 |
| Failed/unresolved media connections | 0 |
| Active/closing publications | 0 |
| Active/closing subscriptions | 0 |
| Open attendance intervals | 0 |
| Recording/uploading/interrupted segments | 0 |
| Existing cleanup job 1, `als-live-staging-cleanup` | Paused (`active=false`) |
| Retained migrations | 46 |

The hosted Teacher Live Classes page was freshly reloaded and reported media/live entry unavailable. Step 2 made no configuration change: `ALS_LIVE_CLASS_ENABLED`, `ALS_LIVE_POC_ENABLED` and `ALS_LIVE_RECORDING_ENABLED` remain at the false values verified in the current completed Hostinger deployment `01a0f6f4-ce72-706a-8c2b-7c125a8d11dd`.

The five original primary academic enrollment rows were checked at **10:37:22.764Z**; IDs, separate Program rows, active status and access start were preserved. Exact expiry remains **2026-10-08T07:40:22.181Z**, or **8 October, 11:40:22.181 Dubai**. No academic reset/reseed, attempt, playback interval or application-source change occurred.

- New class ID: **none**.
- Establishment / abandonment timestamps: **none; not attempted**.
- Scheduled cleanup run/request number for Step 2: **none**.
- Provider reconciliation outcome: **not obtained**.
- Manual cleanup action required/performed: **none**; no manual cleanup POST.
- Scheduler resume/pause, provider replacement, Hostinger redeploy or R2 operation in Step 2: **none**.

## Exact separate credential decision needed

Before resuming this acceptance, approve containment of **only** the staging `CF_REALTIME_APP_SECRET` for the existing `als-live-poc-sfu` app and `CF_TURN_KEY_API_TOKEN` for the existing `als-live-poc-turn` key, subject to:

1. Read-only provider ownership and exact-consumer checks, with no secret values emitted.
2. Establish the supported equivalent replacement/revocation mechanism for each existing staging resource. Stop if it requires a new resource, broader permission, purchase, production/shared dependency or unsupported rotation.
3. Replace only verified staging consumers in designated ignored configuration and the existing Hostinger app; preserve R2, Supabase, academic data, expiry and accepted source.
4. Verify replacement access, revoke the affected old provider authority using the supported mechanism, and verify the academic app. Keep media flags disabled and cleanup cron paused throughout containment.

This is a prepared separate decision, **not an authorization already granted by Step 2**. After containment, the already requested bounded microphone-only abandonment/cron acceptance can resume. No screen share or recording work is included.

## Retry evidence retained

The existing cleanup-read implementation retries only exact `PGRST303` / `JWT issued at future` reads with 500 ms and 1,500 ms delays (at most three read attempts). Writes/provider calls are not replayed by that read retry. No credential tampering or synthetic transient was introduced in this blocked preflight. Prior scheduled runs 41/42 remain historical provider-free database evidence and are not counted as Step 2 provider-cleanup acceptance.

References: [Step 1 credential containment](ALS-STAGING-CREDENTIALS-STEP1-2026-10-01.md), [manual release incident report](ALS-MANUAL-TEST-RELEASE.md), [30 September historical classroom evidence](HOSTED-CLASSROOM-ACCEPTANCE-2026-09-30.md). Provider inspection uses the documented [Cloudflare SFU Connection API](https://developers.cloudflare.com/realtime/sfu/api/); no inspection was performed after this task's credential stop condition.
