# ALS staging Cloudflare containment — 1 October 2026

## Final result — containment and Step 2 completed

| Requested verdict | Result |
| --- | --- |
| CLOUDFLARE SFU REPLACEMENT | **VERIFIED** |
| OLD SFU RESOURCE | **DELETED** — exact old resource absent; old authority returns HTTP 404 |
| CLOUDFLARE TURN REPLACEMENT | **VERIFIED** |
| OLD TURN RESOURCE | **DELETED** — exact old resource absent; old authority returns HTTP 404 |
| ACADEMIC REGRESSION | **PASS** |
| STEP 2 SCHEDULED DB CLEANUP | **PASS** — existing job 1, run/request 45 |
| STEP 2 ACTUAL PROVIDER CLEANUP | **PASS** — exact provider session explicitly expired, HTTP 410 / `session_error`; scheduled reconciliation confirmed absence |
| HEALTHY-RESOURCE ISOLATION | **PASS** — unrelated scheduled fixture unchanged |
| FINAL STAGING STATE | **SAFE** |
| LIVE ENTRY / RECORDING | **DISABLED**; POC disabled; cron paused |
| PRODUCTION | **UNCHANGED** |

### Deletion and continued authentication

- The owner confirmed the bundled action-time permanent-deletion request. On resumption, the old SFU resource was already absent from its verified account overview. Its actual deletion time/actor is unknown; no timestamp is fabricated. No second deletion or replacement creation was attempted.
- The exact old TURN key deletion was submitted at **2026-10-01T12:12:56.766Z**. At **12:13:29.360Z**, both overview tables contained their one expected replacement and neither old ID.
- At **2026-10-01T12:13:44.049Z**, a harmless GET of a historical old SFU session with the old authority returned **404**, and attempted 60-second TURN credential generation with the old authority returned **404**. No provider response body or secret was emitted or retained. Old credentials were passed privately in process input, not written into an old-secret rollback file.
- Replacement access remained valid at **12:14:00.635Z**: the known inert SFU session explicitly expired with HTTP 410 / `session_error`, and replacement TURN generation succeeded with HTTP 201, TTL 60 seconds. Real browser publication later returned HTTP 200 on the exact replacement app, proving active SFU use.
- No payment, subscription deletion/creation, plan upgrade, permission expansion, new R2 bucket, credential rotation in Supabase/R2, unrelated resource deletion or Production operation occurred. Historical non-secret IDs/database audit rows were preserved before deletion.

### Step 2 and final state

- One fresh synthetic class: **`92cd68dd-549a-4e71-9dad-5f85d2197245`**. Real Teacher microphone only, no Student receiver, camera/screen/recording off. See [full shutdown acceptance](ALS-STAGING-STEP2-SHUTDOWN-2026-10-01.md) for setup corrections and exact provider/database evidence.
- Teacher browser destroyed at **12:33:34.137Z**, without Leave or End. Database connection/publication/attendance remained active/open afterwards; no classroom page remained open.
- Existing cron resumed **12:34:22.180Z**. Run/request **45**, **12:35 UTC**, returned HTTP 200 and closed the stale connection/attendance plus terminal publication. Run/request **46**, **12:36 UTC**, returned HTTP 200 and completed the expired class. Cron paused **12:36:46.189Z**. No manual cleanup POST or manual provider close was used during Step 2.
- Provider outcome is **`confirmed_absent_or_expired`**, HTTP **410 / `session_error`**, no retry pending. The provider had already expired the session after browser abandonment and before cron resumed. This proves actual resource absence plus scheduled reconciliation; it is not evidence of a forced close of a still-active provider session.
- Healthy unrelated fixture **`f92fdb1d-1c18-505c-a09d-a7b14ebe0daf`** matched its pretest row exactly before and after cleanup. This checks scheduled-fixture isolation, not a simultaneous second live publisher.
- Final configuration-only Hostinger deployment **`01a0f778-4b3f-71fb-8713-f555234cb137`**, Completed. Private readback at **12:41:31.094Z** matched all 25 expected values: all three media flags false, replacement provider references retained, R2/Supabase unchanged. Accepted application source/ZIP unchanged.
- Guarded database check **12:40:37.245331Z**: zero live classes, open/reconnecting/failed connections, active/closing publications/subscriptions, open attendance and recording/upload/interrupted segments; job 1 paused, 46 migrations. Exact new provider session again returned HTTP 410 at the final observation **12:42:46.634998Z**; the inert verification session was also explicitly expired.
- All 22 academic checks pass after acceptance; genuine hosted Student access restored. Teacher live entry is unavailable; Student class view shows ended with no Join control. Five original enrollment IDs, separate Program rows, active status/start, exact expiry **2026-10-08T07:40:22.181Z**, results and **44.013 seconds** watch history preserved. No new attempt, playback, reseed, reset, migration or source edit.

Evidence: [SFU replacement remains](evidence/als-provider-replacement-20261001/sfu-after-deletion.png), [TURN replacement remains](evidence/als-provider-replacement-20261001/turn-after-deletion.png), [final completed deployment](evidence/als-shutdown-20261001/hostinger-final-disabled.png), [Student class ended](evidence/als-shutdown-20261001/student-class-ended.png).

## Historical replacement checkpoint — before action-time confirmation

The owner subsequently approved replacing exactly the two exposed staging resources and deleting the old resources after all replacement checks pass. No Production/shared dependency, new subscription, billing change, R2 change or Supabase change is authorized.

| Resource | Historical name / ID | Replacement name / ID |
| --- | --- | --- |
| SFU | `als-live-poc-sfu` / `40e420640816dc9b001da1c95406c235` | `als-staging-sfu-containment-20261001` / `6306f9d5f836a1aa08b0d6bbde22f10b` |
| TURN | `als-live-poc-turn` / `4ac123acad18fec90a7c6013054dbc8d` | `als-staging-turn-containment-20261001` / `19951d8aa17f40210ffc756ba8c1ba3a` |

- SFU replacement created at **2026-10-01T11:00:48.334Z**; TURN replacement at **2026-10-01T11:01:48.391Z**, in the same verified configured Cloudflare account. Creation presented no payment, plan change or account permission grant. No resource-secret expiry control was exposed.
- Provider verification at **2026-10-01T11:03:28.225Z**: replacement SFU session creation HTTP 201, exact session GET HTTP 200 with zero tracks; replacement TURN credential generation HTTP 201 with a 60-second TTL. Generated credentials were not emitted or retained.
- Inert SFU verification session: `8d819ff706e7d96887a195bc0f9d6590e17bdcf451fcb597c70e2c57478f0851`. At **2026-10-01T11:14:17.044Z**, the provider explicitly returned HTTP 410 / `session_error`; replacement TURN generation remained HTTP 201. No WebRTC publication was established by these checks.
- Both approved staging consumers now contain the replacement IDs and credentials: ignored `als-hostinger-staging/.env.hostinger.live.local` and the existing Hostinger staging environment. Only the four `CF_REALTIME_APP_ID`, `CF_REALTIME_APP_SECRET`, `CF_TURN_KEY_ID`, `CF_TURN_KEY_API_TOKEN` labels changed. All other hosted values matched the saved baseline, including R2, Supabase, guard and disabled media flags.
- Configuration-only Hostinger deployment **`01a0f728-aa16-71a3-bf3c-1f80f55d6708`** completed using the previous accepted source files. All 25 hosted values were privately read back and matched. Temporary credential capture was removed after installation; no old-secret rollback file was created.
- Anonymous staging gate remains HTTP 307. All 22 fixture/authorization checks pass; five original primary enrollment IDs, separate Program rows, status and start are preserved. Exact expiry remains **2026-10-08T07:40:22.181Z**.
- At **2026-10-01T11:15:18.155Z**, the protected hosted cleanup route accepted its existing separate Vault token with zero candidate categories, HTTP 200, zero provider calls and zero row changes. This is a containment regression check, not scheduled Step 2 acceptance.
- Historical non-secret connection/session/publication/reconciliation identifiers were exported before deletion into ignored `.local-qa/credential-step2/historical-provider.json`. Existing database audit rows remain intact. Source workflows contain neither historical resource ID as a hardcoded dependency.
- Genuine hosted Teacher, Admin and Student sign-ins passed after the replacement deploy. Teacher Question Bank loaded with Add question enabled; the Student private synthetic image decoded successfully. No question, attempt or playback mutation occurred.
- Focused cleanup/retry tests: **3 files / 11 tests passed** at 15:19 Dubai. These include controlled transient read recovery, a three-attempt bound, provider closure/expiry handling, and terminal reconciliation normalization; no deployed credential was tampered with.
- Fresh guarded database observation at **2026-10-01T11:29:03.307765Z**: zero live classes, open/reconnecting/failed connections, active/closing publications/subscriptions, open attendance and recording/upload/interrupted segments; job 1 paused, 46 migrations preserved.
- **Old resources are still retained at this checkpoint.** Both exact old-resource deletion dialogs are prepared and show permanent, nonrecoverable deletion. The computer-use policy requires user confirmation at action time even with earlier preapproval. One bundled confirmation for those two exact IDs was requested after all replacement checks passed; no deletion has been submitted. No provider subscription, R2 resource or unrelated resource is selected.
- Step 2 is prepared but **not executed while that required confirmation is pending**: no fresh class, real publication, abandonment or scheduled acceptance run exists. The Admin schedule form contains permitted synthetic scope and recording unchecked but has not been submitted. Existing last cron run/request ID is 44; the next acceptance must start with a fresh quiet-state check and bounded window after deletion/rejection verification. No manual cleanup action is part of the planned acceptance.
- The previous blocked report below is retained as historical evidence, not the current replacement verdict. Resource replacement verification is complete; containment remains incomplete until old-resource deletion and rejection checks pass.

Safe deployment evidence: [replacement completed](evidence/als-provider-replacement-20261001/hostinger-replacement-completed.png).
Safe pending-action evidence: [exact old SFU dialog](evidence/als-provider-replacement-20261001/old-sfu-delete-confirmation.png), [exact old TURN dialog](evidence/als-provider-replacement-20261001/old-turn-delete-confirmation.png), [Student regression](evidence/als-provider-replacement-20261001/student-regression.png).

## Historical result before resource-replacement approval

**Containment is blocked by the existing-resource restriction.** The owner approved replacement of `CF_REALTIME_APP_SECRET` and `CF_TURN_KEY_API_TOKEN` on the existing staging resources and explicitly excluded deleting/recreating those resources. No supported in-place credential replacement/revocation operation was found in the current dashboard or official SFU/TURN management API. No credential, resource, deployment or feature setting was changed.

| Requested verdict | Result |
| --- | --- |
| SFU OLD CREDENTIAL | **BLOCKED** — not revoked; current authentication validity not asserted |
| SFU REPLACEMENT | **BLOCKED** — none created |
| TURN OLD CREDENTIAL | **BLOCKED** — not revoked; current authentication validity not asserted |
| TURN REPLACEMENT | **BLOCKED** — none created |
| SHARED/PRODUCTION DEPENDENCY | **NONE FOUND** in inspected configurations, Vault and verified hosted consumer; undiscovered remote consumers remain unknown |
| ACADEMIC REGRESSION | **PASS** on the unchanged current app; no post-replacement regression is claimed |
| STEP 2 PROVIDER CLEANUP | **UNPROVEN** — containment has not passed, so no new media session or abandonment fixture |
| FINAL STAGING | **SAFE** — zero active media, cron paused, all media flags false |
| PRODUCTION | **UNCHANGED** |

## Verified dependencies and ownership

- Provider dashboard account matched the configured staging Cloudflare account. The existing `als-live-poc-sfu` and `als-live-poc-turn` resource IDs matched the designated local configuration exactly; comparisons emitted booleans, not secret values or fragments.
- Existing Hostinger deployment remains `01a0f6f4-ce72-706a-8c2b-7c125a8d11dd`, Completed. A read-only inspection of its redeploy form confirmed both current provider credentials and both resource IDs match ignored `als-hostinger-staging/.env.hostinger.live.local`. The form was exited without save/redeploy.
- A private comparison across local project `.env*` and `.dev.vars*` configuration files found matching credentials only in that designated ignored staging file. No matching Production, other application or retained local POC configuration was found among inspected files.
- Staging Vault contains neither provider credential. Existing job 1, `als-live-staging-cleanup`, is paused and targets the existing authenticated Hostinger cleanup endpoint using the separate `als_staging_cleanup_token` Vault entry.
- Cleanup/reconciliation consumes the hosted SFU secret through `provider.ts` and `transport-cleanup.ts`; it has no separate credential copy. TURN generation consumes the hosted TURN token through `provider.ts`.
- No historical secret-bearing tool output was reopened or replayed. Harmless output-filter sentinels passed before dashboard work; environment observations emitted only allowlisted booleans. No generated TURN credentials were requested or emitted.

## Supported mechanism findings

Both existing resource menus show only **View usage** and **Delete**. No credential rotation, regeneration or expiry control was exposed there.

- [SFU app update API](https://developers.cloudflare.com/api/resources/calls/subresources/sfu/methods/update/) accepts only the optional `name` field and returns resource metadata, not a replacement secret.
- [TURN key update API](https://developers.cloudflare.com/api/resources/calls/subresources/turn/methods/update/) likewise accepts only optional `name` and returns metadata.
- The documented [SFU creation API](https://developers.cloudflare.com/api/resources/calls/subresources/sfu/methods/create/) and [TURN creation API](https://developers.cloudflare.com/api/resources/calls/subresources/turn/methods/create/) issue the resource-bound bearer authority at creation. That is different from rolling an account/profile API token; no account-wide token was changed.
- [TURN credential generation](https://developers.cloudflare.com/realtime/turn/generate-credentials/) produces short-lived client ICE credentials. Generating or revoking those client credentials does not replace the exposed long-term TURN generation authority.

The conclusion is limited to the current documented API and observed dashboard. An undocumented provider/support mechanism was not assumed or called. Resource creation and deletion were not attempted to work around the owner's explicit restriction. No provider expiry timestamp was invented.

Safe dashboard evidence: [SFU action menu](evidence/als-provider-containment-20261001/sfu-actions.png), [TURN action menu](evidence/als-provider-containment-20261001/turn-actions.png). The screenshots display names and resource identifiers only, not credentials.

## Academic and safe-state verification

- Anonymous hosted root: HTTP 307 to the staging gate.
- Genuine hosted Teacher, Admin and Student sign-ins: PASS.
- Teacher Question Bank: loaded, Add question enabled; no authoring mutation.
- Student private synthetic image: loaded; no new playback or attempt.
- All 22 fixture/authorization checks passed; previous 44.013-second watch history and existing submitted results were retained.
- Five original primary enrollment IDs, separate Program rows, active status and start remained unchanged. Exact expiry: **2026-10-08T07:40:22.181Z**, or **8 October, 11:40:22.181 Dubai**.
- Existing Vault cleanup token authenticated the protected cleanup route at **2026-10-01T10:48:34.901Z**. With all five candidate categories zero, it returned HTTP 200, zero inspected/expired classes and zero attendance closures: no provider calls or row changes. This credential-task check is **not** scheduled Step 2 acceptance.
- Private current hosted readback matched all 25 saved deployment values. R2 replacement/guard and Supabase replacement remain unchanged; `ALS_LIVE_CLASS_ENABLED`, `ALS_LIVE_POC_ENABLED` and `ALS_LIVE_RECORDING_ENABLED` are all false. Hosted Teacher live entry remains unavailable.
- Final guarded database check at **2026-10-01T10:51:58.790849Z**, or **1 October, 14:51:58.790849 Dubai**: zero live classes, open/reconnecting/failed connections, active/closing publications and subscriptions, open attendance, and recording/uploading/interrupted segments. Cron job 1 paused; 46 migrations retained.
- No class was created, no scheduler resumed, no credential/resource/configuration change, no migration/reset/reseed, no application-source edit, no Git push, billing change or Production action.

## Historical separate approval boundary — subsequently granted

Approve creating **one replacement staging SFU app and one replacement staging TURN key**, followed by deleting **only** the exposed old `als-live-poc-sfu` and `als-live-poc-turn` resources after replacement checks and verified consumer installation. This changes staging resource identity and is outside the current approval.

Prepared sequence:

1. Recheck exact ownership, quiet state and verified staging consumers; stop if a Production/shared dependency appears.
2. Create the two replacement resources in the same approved account with clearly labelled ALS staging names. Use resource-bound bearer credentials without general account administration access. Record any provider-supported lifetime; if absent, report it and retain the staging operational cutoff rather than inventing expiry.
3. Capture secrets directly into designated ignored staging configuration. Verify SFU authentication with the smallest provider operation and TURN credential generation without emitting ICE credentials or establishing media.
4. Update only `CF_REALTIME_APP_ID`, `CF_REALTIME_APP_SECRET`, `CF_TURN_KEY_ID` and `CF_TURN_KEY_API_TOKEN` in verified staging consumers; reuse the accepted source for a configuration-only Hostinger restart. Preserve R2, Supabase, all academic rows/history and exact expiry. Keep media disabled and cron paused.
5. Verify installed replacements and academic regression; delete only the two exact exposed staging resources using the supported provider mechanism. Preserve historical database audit rows. Verify old authorities can no longer access their removed resources and replacements still work; no old-secret rollback copy.
6. Once containment passes, resume the already approved Step 2 microphone-only abandonment test. Existing cron only; approximately 2–3 minutes active media, provider reconciliation evidence, healthy-resource isolation, then zero active media, paused cron and disabled entry. No screen share or recording.

Alternatively, keep the acceptance blocked and pursue a provider-supported in-place replacement method with Cloudflare. No support message has been sent.
