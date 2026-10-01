# ALS staging Cloudflare containment — 1 October 2026

## Result

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

## Concrete separate approval needed

Approve creating **one replacement staging SFU app and one replacement staging TURN key**, followed by deleting **only** the exposed old `als-live-poc-sfu` and `als-live-poc-turn` resources after replacement checks and verified consumer installation. This changes staging resource identity and is outside the current approval.

Prepared sequence:

1. Recheck exact ownership, quiet state and verified staging consumers; stop if a Production/shared dependency appears.
2. Create the two replacement resources in the same approved account with clearly labelled ALS staging names. Use resource-bound bearer credentials without general account administration access. Record any provider-supported lifetime; if absent, report it and retain the staging operational cutoff rather than inventing expiry.
3. Capture secrets directly into designated ignored staging configuration. Verify SFU authentication with the smallest provider operation and TURN credential generation without emitting ICE credentials or establishing media.
4. Update only `CF_REALTIME_APP_ID`, `CF_REALTIME_APP_SECRET`, `CF_TURN_KEY_ID` and `CF_TURN_KEY_API_TOKEN` in verified staging consumers; reuse the accepted source for a configuration-only Hostinger restart. Preserve R2, Supabase, all academic rows/history and exact expiry. Keep media disabled and cron paused.
5. Verify installed replacements and academic regression; delete only the two exact exposed staging resources using the supported provider mechanism. Preserve historical database audit rows. Verify old authorities can no longer access their removed resources and replacements still work; no old-secret rollback copy.
6. Once containment passes, resume the already approved Step 2 microphone-only abandonment test. Existing cron only; approximately 2–3 minutes active media, provider reconciliation evidence, healthy-resource isolation, then zero active media, paused cron and disabled entry. No screen share or recording.

Alternatively, keep the acceptance blocked and pursue a provider-supported in-place replacement method with Cloudflare. No support message has been sent.
