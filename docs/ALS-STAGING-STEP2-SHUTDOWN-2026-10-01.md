# ALS Step 2 — unattended shutdown preflight, 1 October 2026

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
