# ALS Step 1 — staging credential containment, 1 October 2026

## A. Redacted exposure inventory

The latest release report records a Hostinger environment-form output incident and a temporary signed PDF URL in a tab title. An earlier Hostinger deployment report explicitly records staging service-role-key exposure. Historical secret-bearing tool traces were **not replayed**; the complete historical exposure scope remains **UNKNOWN**. This inventory contains labels and status only, never values or fragments.

| Variable/label | Service / permission type | Environment or resource | Status | Staging-only or shared | Action |
| --- | --- | --- | --- | --- | --- |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` — previous pair | Cloudflare R2 Object Read & Write | `als-live-poc-recordings` | **Confirmed expired:** provider says Inactive since 1 October 2026 | Exact old pair matched Hostinger staging and its ignored local configuration; no matching other local project configuration found. Remote dependencies outside inspected staging configuration remain unknown. | Replaced once; never used as rollback. |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` — replacement | Cloudflare R2 Object Read & Write | Existing private `als-live-poc-recordings` bucket only | **Confirmed active**; tiny real S3 test passed | Verified isolated Hostinger staging and designated ignored configuration | Installed; expires on provider's displayed 8 October date. |
| `SUPABASE_SERVICE_ROLE_KEY` — exposed key | Individually managed privileged Supabase server key; Auth Admin access | `slghshcdaijbcjfoqerq` | **Confirmed revoked:** absent from provider key inventory; harmless Auth Admin lookup now returns HTTP 401 | Exact match found only in designated local staging configuration and Hostinger staging among inspected consumers; no matching Vault entry or Edge Function consumer | Replaced and revoked under separate explicit owner approval. No signing-key rotation. |
| `SUPABASE_SERVICE_ROLE_KEY` — replacement | Equivalent individually managed privileged server key | Same isolated staging project | **Confirmed active:** known synthetic Teacher lookup returns HTTP 200; protected hosted cleanup read succeeds after old-key revocation | Existing Hostinger staging app and ignored `.env.staging.local` | Installed and verified; only this hosted label changed during Supabase containment. |
| `ALS_STAGING_CLEANUP_TOKEN` | Protected staging cleanup-route authorization | Existing Hostinger staging app | **Confirmed active:** existing Vault token authenticated the protected route | Paused staging cron targets this app and references `als_staging_cleanup_token` | Preserved; no rotation authorized. Historical exposure scope remains unknown. |
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
- R2 configuration deployment checkpoint: **`01a0f6d2-acbf-7354-8560-771584bb859a`**. Installation reported zero vulnerabilities; build and standalone application restart completed. Private saved-environment readback matched the replacement. The later Supabase-only configuration deployment in section F is now current.
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

## F. Separately approved Supabase containment

The owner separately approved staging Supabase key containment on 1 October. The approved scope was:

> Approve replacing and revoking only the individually managed Supabase secret key used as `SUPABASE_SERVICE_ROLE_KEY` for project `slghshcdaijbcjfoqerq`, after a read-only dependency check of Hostinger, designated staging configuration and any paused staging cleanup/Vault consumer. Update only those verified staging consumers, verify the replacement and academic regression, then revoke the exposed key. Stop if a production/shared dependency appears. Do not rotate Supabase signing keys, passwords or production credentials, and keep media disabled.

Read-only dependency checks confirmed the old key is an individually managed secret key, not a legacy signing key. Its exact value matched the existing Hostinger staging environment and the designated ignored `.env.staging.local`. The paused cleanup job targets this staging app and uses the separate `als_staging_cleanup_token` Vault entry. No Vault entry contains the exposed Supabase key, and the staging project has no Edge Functions. No production/shared dependency was discovered in the inspected consumers; undiscovered remote consumers remain unknown.

One equivalent privileged server key was created through the Supabase Management API and passed a read-only Auth Admin lookup of the known synthetic Teacher. Initial requests using a hyphenated management label returned HTTP 400; the provider name schema requires underscores, and no key was created by those rejected requests. The successful key is named `als_hostinger_staging_containment_2026_10_01`. Hostinger received only the replacement `SUPABASE_SERVICE_ROLE_KEY`; its other 24 environment values, accepted application source, R2 pair/guard, npm/Node settings and disabled media flags were privately checked unchanged.

Current Hostinger deployment **`01a0f6f4-ce72-706a-8c2b-7c125a8d11dd`** is **Completed / Current**, displayed at **14:16 Dubai on 1 October**. It restored the previous accepted source, used npm/Node 22, reported zero vulnerabilities and restarted the standalone app. [Safe completed-deployment screenshot](evidence/als-credentials-step1-20261001/supabase-config-redeployment.png). Saved environment readback verified the replacement and the other 24 unchanged values.

After restart, all 22 fixture/authorization checks passed. Genuine hosted Teacher, Admin and Student logins passed; Teacher question authoring remained available and the Student's private synthetic image loaded. The Student dashboard retained 2/5 completed tests and 7/7 visible marks, and measured watch history remained 44.013 seconds. All five original enrollment rows and exact academic expiry were preserved.

The protected staging cleanup route was checked with a database precondition of zero live classes, candidate connections, publications, subscriptions and open attendance intervals. It returned HTTP 200 with zero expired classes, zero orphan attendance closures and zero inspected classes; therefore no provider calls or row modifications occurred. This also verified the existing Vault cleanup-token dependency without changing it or unpausing cron.

The designated ignored `.env.staging.local` was then updated for this label only, and the exposed individually managed key was deleted through the Management API. At **2026-10-01T10:20:40.466Z**, the old key was absent from provider inventory and its harmless Auth Admin read returned **HTTP 401**; the replacement returned **HTTP 200**. The hosted zero-candidate cleanup check passed again after revocation at **10:21:00.363Z**, confirming the restarted consumer remains functional. No Vault service-key update was needed. The temporary replacement capture file was removed after installation; no old-key rollback copy was created.

Final database readback retained 46 migrations, paused cron, zero live classes/connections/active segments and the unchanged unpublished historical recording. No signing keys, passwords, production/shared credentials or application source were changed.

The cleanup, SFU, TURN and gate credentials require separate validity/dependency review before proposing any additional rotation. Their unknown historical exposure is not declared resolved by the R2 or Supabase work.

## Verdicts

- **R2 STAGING ACCESS: VERIFIED.**
- **OLD R2 CREDENTIAL: EXPIRED.**
- **SECRET-OUTPUT PREVENTION: VERIFIED for this task.** Local filtering was tested with harmless credential and signed-URL sentinels before dashboard work. Environment forms emitted only allowlisted labels/booleans, never complete DOM snapshots or values. Credential confirmation values went directly to ignored storage; no auth/browser storage dump occurred. Historical incident scope remains unknown.
- **STAGING SUPABASE KEY CONTAINMENT: RESOLVED** for the identified individually managed exposed key and verified consumers.
- **OTHER EXPOSED CREDENTIALS: UNKNOWN** where historical exposure or remote dependencies cannot be established. Cleanup token validity is verified; SFU, TURN, gate and account/session exposure scope is not declared resolved. No additional secret rotation is authorized or performed.
- **LIVE CLASSES: STILL DISABLED.**
- **PRODUCTION: UNCHANGED.**

Provider mechanism reference: [Cloudflare R2 authentication and bucket-scoped token permissions](https://developers.cloudflare.com/r2/api/tokens/).

Supabase mechanism references: [Create an individually managed API key](https://supabase.com/docs/reference/api/v1-create-project-api-key), [delete that API key](https://supabase.com/docs/reference/api/v1-delete-project-api-key), and [API-key types](https://supabase.com/docs/guides/getting-started/api-keys).
