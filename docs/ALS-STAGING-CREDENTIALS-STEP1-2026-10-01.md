# ALS Step 1 — staging credential containment, 1 October 2026

## A. Redacted exposure inventory

The latest release report records a Hostinger environment-form output incident and a temporary signed PDF URL in a tab title. An earlier Hostinger deployment report explicitly records staging service-role-key exposure. Historical secret-bearing tool traces were **not replayed**; the complete historical exposure scope remains **UNKNOWN**. This inventory contains labels and status only, never values or fragments.

| Variable/label | Service / permission type | Environment or resource | Status | Staging-only or shared | Action |
| --- | --- | --- | --- | --- | --- |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` — previous pair | Cloudflare R2 Object Read & Write | `als-live-poc-recordings` | **Confirmed expired:** provider says Inactive since 1 October 2026 | Exact old pair matched Hostinger staging and its ignored local configuration; no matching other local project configuration found. Remote dependencies outside inspected staging configuration remain unknown. | Replaced once; never used as rollback. |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` — replacement | Cloudflare R2 Object Read & Write | Existing private `als-live-poc-recordings` bucket only | **Confirmed active**; tiny real S3 test passed | Verified isolated Hostinger staging and designated ignored configuration | Installed; expires on provider's displayed 8 October date. |
| `SUPABASE_SERVICE_ROLE_KEY` | Individually managed privileged Supabase server key; Auth Admin access | `slghshcdaijbcjfoqerq` | **Confirmed active:** read-only lookup of the known synthetic Teacher succeeded; no account/auth data was emitted. Direct HEAD of questions returned 403 and was not treated as a successful privilege check. | Hostinger value matches staging `.env.staging.local`; remote Vault/cleanup or other staging dependencies require verification | **Separate containment approval required.** Earlier report explicitly documents exposure. Do not rotate signing keys automatically. |
| `ALS_STAGING_CLEANUP_TOKEN` | Protected staging cleanup-route authorization | Existing Hostinger staging app | **Unknown** current validity; configured, no authentication test or rotation performed | Verified Hostinger staging label; scheduler/Vault dependencies unknown | Include in separate dependency/containment review; paused cron was preserved. |
| `CF_REALTIME_APP_SECRET` | Server SFU application authentication | Existing staging SFU configuration | **Unknown** current provider validity; configured | Only designated local staging copy located; provider/shared dependencies not exhaustively audited | Separate scoped approval if containment is needed; no provider secret replaced. |
| `CF_TURN_KEY_API_TOKEN` | TURN credential-generation authorization | Existing staging TURN configuration | **Unknown** current provider validity; configured | Only designated local staging copy located; provider/shared dependencies not exhaustively audited | Separate scoped approval if containment is needed; no token replaced. |
| `ALS_STAGING_ACCESS_PHRASE`, `ALS_STAGING_COOKIE_SECRET` | Staging access gate and gate-cookie signing | Existing Hostinger staging app | **Unknown** individual credential validity; configured and staging access gate enforced | Matching copies in the two designated ignored Hostinger staging configurations | Separate gate containment review/approval; values unchanged. |
| Temporary signed PDF URL | Time-limited bearer access to one private content object | Synthetic staging material | **Unknown** historical URL expiry; not replayed or emitted | Object-specific temporary URL, not an account/server key | Do not replay; no assumption that R2 expiry revoked a separate Supabase Storage URL. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; account/app/bucket identifiers and feature flags | Public/client configuration and identifiers | Staging | Not treated as reusable server secrets | Configuration scope checked | No rotation solely because these labels appeared. Values omitted here. |
| Account passwords, provider account sessions, cookies, Supabase signing keys and production/shared credentials | Account/session or broader authority | Historical output scope unknown | **Unknown exposure**; no confirmed new exposure or validity audit claimed | Unknown where not verified | No dumps, no password/signing-key/production rotation; request exact approval if confirmed affected. |

Local matching checks compared values in memory and emitted only filenames/labels and booleans. They do not prove absence of undiscovered remote consumers.

## B. Replacement scope and expiry

- Created **one** User API Token using the same supported R2 mechanism as the expired token: `ALS Isolated Staging R2 Replacement 2026-10-01`.
- Existing account identity matched the local staging account; bucket identity matched `als-live-poc-recordings`; provider bucket UI showed **Public Access Disabled** and Standard storage.
- Selected **Object Read & Write**, **Apply to specific buckets only**, exactly that bucket, and **1 week** TTL. No Admin permission, other bucket, subscription or billing action.
- Provider status: **Active until Oct 8, 2026**. The UI exposes **no exact expiry hour or timezone**; neither is invented here. One-week TTL was selected; conservative application guard is **2026-10-08T00:00:00Z** (8 October, 04:00 Dubai). This guard is not represented as the actual provider expiry instant.
- Stored only in the designated ignored `.env.hostinger.live.local` and the existing Hostinger app's server environment. The temporary one-time capture file was removed after installation. Both storage locations were checked as ignored/private deployment configuration; no credentials entered source, Git, ZIP, report or screenshots.
- Only `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and the conservative `ALS_STAGING_CREDENTIAL_EXPIRES_UTC` changed. All other hosted environment values were compared privately and remained identical.
- Configuration-only redeploy reused the previous accepted source ZIP and working npm/Node 22 settings. Application source remains `a267b969b6c6e355d183db585f3dac9a9f8d0c07`; source ZIP SHA-256 remains `2a104e65e331be9a44318ce7ba685fddc740210fa7d87f4f16be22a426629979`.
- Current completed Hostinger configuration deployment: **`01a0f6d2-acbf-7354-8560-771584bb859a`**. Installation reported zero vulnerabilities; build and standalone application restart completed. Private saved-environment readback matches the replacement.
- Completed at **13:39 Dubai** on 1 October. [Safe deployment screenshot](evidence/als-credentials-step1-20261001/hostinger-redeployment.png).
- No other consumer of the exact old R2 pair was found in the local environment configurations checked. Worker bucket bindings are not this S3 credential pair and were not changed.

## C. Old credential

Provider token table identifies `ALS Live POC Local 2026-09-24`, the same bucket and Object Read & Write scope, as **Inactive since Oct 1, 2026**. The previous Hostinger pair matched that designated local staging configuration. The replacement table row is independently active. The expired key was not retained as a rollback credential and was not used for unrelated object access.

[Safe provider status screenshot](evidence/als-credentials-step1-20261001/provider-token-status.png) shows the replacement and expired token rows; no credential values are visible.

## D. Tiny real storage verification

At **2026-10-01T09:33:30.860Z** (13:33:30 Dubai), a local S3 client using the replacement performed one uniquely named, test-owned **1,024-byte** object check in the existing private bucket:

| Operation | Actual result |
| --- | --- |
| Write | HTTP 200 |
| HEAD | HTTP 200; exactly 1,024 bytes and expected test metadata/digest |
| Readback | Bytes identical to the original random test payload |
| Delete only that object | HTTP 204 |
| HEAD after delete | HTTP 404, object absent |

No unrelated objects were listed/downloaded/modified by the S3 check. Opening the bucket's existing dashboard showed its top-level directory; retained recordings were not opened or altered. No signed links were generated or emitted. Evidence is in ignored `.local-qa/credential-step1/storage-check.json`.

This proves credential access from the S3 client and verified hosted configuration installation. It does **not** prove hosted recording, CORS, validation/publication, Student replay or unattended media shutdown. No diagnostic endpoint was added.

## E. Academic and safety regression

- Unauthenticated hosted root returned HTTP 307 to `/_staging-access`: gate preserved.
- Normal hosted Student, Teacher and Admin sign-in: **PASS**.
- Student course/subject access and private synthetic image: **PASS**. No new playback interval or assessment attempt was created.
- Student dashboard retained **2/5 completed tests**, **7/7 visible marks** and prior measured watch history. Twenty-two authenticated fixture/authorization checks passed, including both primary Students and expired/unenrolled/unassigned denial cases.
- Teacher Question Bank loaded with authoring enabled; no question/test was created or edited in this task.
- Five original active primary enrollment rows, separate Program rows, access starts and expiry remained unchanged. Exact expiry remains **2026-10-08T07:40:22.181Z**, or **8 October, 11:40:22.181 Dubai**.
- No reset/reseed, migration, new attempt, enrollment renewal, app-source edit, Git push or production change.
- Before mutation, staging showed zero live classes, zero open media connections and zero recording/upload/interrupted segments; cron job 1 remained paused. Retained historical recording is an idle `validating` registry, not an active validation job. No validation operation was triggered.
- All three hosted flags `ALS_LIVE_CLASS_ENABLED`, `ALS_LIVE_POC_ENABLED`, `ALS_LIVE_RECORDING_ENABLED` remained **false**, with private saved readback confirming this. Valid R2 credentials do not establish safe unattended closure.
- Hosted Teacher Live Classes displayed **Live entry currently unavailable** for scheduled classes. Final staging readback again showed 46 migrations, paused cleanup, zero live classes/connections/active segments and the unchanged unpublished historical registry.

## F. Other containment requiring approval

The active staging `SUPABASE_SERVICE_ROLE_KEY` is the concrete unresolved privileged credential. Proposed separate authorization:

> Approve replacing and revoking only the individually managed Supabase secret key used as `SUPABASE_SERVICE_ROLE_KEY` for project `slghshcdaijbcjfoqerq`, after a read-only dependency check of Hostinger, designated staging configuration and any paused staging cleanup/Vault consumer. Update only those verified staging consumers, verify the replacement and academic regression, then revoke the exposed key. Stop if a production/shared dependency appears. Do not rotate Supabase signing keys, passwords or production credentials, and keep media disabled.

The cleanup, SFU, TURN and gate credentials require separate validity/dependency review before proposing any additional rotation. Their unknown historical exposure is not declared resolved by the R2 test.

## Verdicts

- **R2 STAGING ACCESS: VERIFIED.**
- **OLD R2 CREDENTIAL: EXPIRED.**
- **SECRET-OUTPUT PREVENTION: VERIFIED for this task.** Local filtering was tested with harmless credential and signed-URL sentinels before dashboard work. Environment forms emitted only allowlisted labels/booleans, never complete DOM snapshots or values. Credential confirmation values went directly to ignored storage; no auth/browser storage dump occurred. Historical incident scope remains unknown.
- **OTHER EXPOSED CREDENTIALS: APPROVAL REQUIRED** for the active staging Supabase key; other historical scope remains **UNKNOWN**.
- **LIVE CLASSES: STILL DISABLED.**
- **PRODUCTION: UNCHANGED.**

Provider mechanism reference: [Cloudflare R2 authentication and bucket-scoped token permissions](https://developers.cloudflare.com/r2/api/tokens/).
