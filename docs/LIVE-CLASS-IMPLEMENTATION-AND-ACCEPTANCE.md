# Native classroom implementation and acceptance

Date: 24 September 2026

Branch: `codex/cloudflare-native-classroom`

Starting commit: `3df3ef59ee5d5d84e07420a0fd47c3e1ba8b610b`

Recorded package baseline: Next.js `16.3.3`, React/React DOM `19.2.8`, Supabase JS `2.115.0`, Supabase SSR `0.12.5`, AWS S3 client/presigner `3.1131.0`, TypeScript `5.x`, Vitest `5.0.0`, and pnpm `11.19.0`. No dependency or framework upgrade was introduced.

## Implemented data flow

An authenticated browser asks a scoped Next.js handler for one explicit operation. The handler verifies active profile, role, current Teacher assignment or Student enrollment/access dates, class state/window, participant connection ownership, grant, and requested object ownership. Only the server calls Cloudflare's Connection API or signs an R2 command. Supabase remains authoritative for schedule, lifecycle, grants, presence/attendance intervals, chat, polls, published tracks/subscriptions, recording manifests/parts, and low-frequency diagnostics.

Each participant owns one active `RTCPeerConnection` and one server-mapped Cloudflare session. Teachers/Admins may publish microphone/camera/screen. Students begin receive-only and may publish microphone or screen only after independent grants. Grant revocation, participant removal, and class end issue forced provider track closes. Clients also re-fetch authoritative state after events and every eight seconds so missed Realtime events do not become authority.

The Teacher recorder draws screen, Teacher camera overlay, or a holding slate into one canvas and combines only that canvas track with the Teacher microphone. Student media, chat, and participant panels are excluded. Ordered MediaRecorder chunks are incrementally stored in IndexedDB, assembled into 8 MiB multipart parts, uploaded sequentially with bounded retry/re-signing, reconciled against R2, completed, `HEAD` verified, locally decoded/seek checked, and kept unpublished until Admin review.

## Principal files and migrations

- `src/lib/live-class/provider.ts`: Cloudflare session/track/renegotiation/forced-close client and separate TURN credentials.
- `src/app/api/live-classes/**`: scheduling, lifecycle/grants/removal, explicit media operations, and recording multipart/playback operations.
- `src/components/live/native-classroom.tsx`: shared Teacher/Student/Admin classroom.
- `src/components/live/recording-playback.tsx`: eligibility-checked expiring playback renewal with position preservation.
- `src/components/admin/live-classes-manager.tsx`: schedule, inspect attendance/recording health, publish/unpublish, and dated configurable estimator.
- `src/lib/live-class/recording-storage.ts`, `multipart-buffer.ts`, `recording-store.ts`, and `recording-parts.ts`: private R2 and recoverable recording pipeline.
- `supabase/migrations/20260924085900_recording_status_values.sql`: recording enum additions in their own committed migration.
- `supabase/migrations/20260924090000_native_cloudflare_classroom.sql`: transport ownership, attendance intervals/leases, recording state, usage summaries, indexes, RLS, private Realtime authorization, and hardened poll rules.

## Feature flags and release boundary

`ALS_LIVE_POC_ENABLED`, `ALS_LIVE_CLASS_ENABLED`, and `ALS_LIVE_RECORDING_ENABLED` default to false. POC routes additionally require a database class with `provider='cloudflare-poc'`; normal entry requires `provider='cloudflare'`. Configuration alone is not production readiness. No migration was applied, no Cloudflare/R2 resource was created, no deployment was made, and no production flag was enabled in this work.

## Automated evidence

| Area | Verdict | Evidence |
|---|---|---|
| Type safety | PASS | `pnpm typecheck` |
| Unit/repository tests | PASS | `pnpm test`; includes irregular part assembly/order/final part, completion validation, dates, profile/enrollment authorization, and independent publishing grants |
| Lint | PASS | `pnpm lint` completed with no errors or warnings |
| Production build | PASS | `pnpm build`; Next.js 16.3.3 compiled all new dynamic routes |
| Database migration execution/RLS against Supabase | BLOCKED | Migration intentionally not applied without an explicitly identified non-production target |
| Real Cloudflare publish/subscribe | BLOCKED | Requires an approved POC class and independent browser sessions; dashboard login alone is not acceptance evidence |
| Forced revocation against an uncooperative client | BLOCKED | Server logic implemented; real provider test not run |
| TURN relay | BLOCKED | Requires separate TURN key configuration and an observed `relay` candidate |
| R2 multipart/recovery/private playback | BLOCKED | Adapter and tests implemented; no real bucket upload performed |
| Two-hour recording, seek/audio sync, Android/iPhone replay | BLOCKED | Requires supported hardware, duration, and real devices |
| 50-receiver capacity | BLOCKED | No paid or large load test was authorized; largest real concurrency tested here is zero |

Read-only dashboard inspection found Cloudflare Realtime SFU and TURN both at the account-level **Get Started** screen and the R2 overview contained no bucket rows. No Get Started/Create action was clicked. Supabase showed two projects: one explicitly named **ALS Production** and one paused project whose intended environment was not established. Therefore no safe non-production migration target was inferred or modified. Local environment inspection (names/status only, never values) found the SFU/TURN variables and all live gates absent; R2 access key variables existed but `R2_BUCKET` was absent.

The built public route was inspected in connected Chrome at the default 1280px viewport and at 390×844: meaningful content rendered, no error overlay or horizontal document overflow was present, and captured console warnings/errors were empty. Protected classroom screens remain visually BLOCKED because no test login plus migrated non-production database was authorized; public-page responsive evidence is not counted as classroom acceptance.

## Known limits and prerequisites

- Browser telemetry counts selected RTP payload counters and is diagnostic, not an invoice or security control.
- A presigned playback URL is a temporary bearer URL, not DRM; an issued URL can work until its 15-minute expiry.
- Cloudflare may garbage-collect inert orphan sessions; there is no fabricated room-delete abstraction. Database/provider partial failures are marked and reconciled where the API exposes track/object state.
- Browser storage is recovery assistance, not absolute durability. Closure, OS sleep, capture revocation, quota exhaustion, and device failure can stop future capture.
- Multi-segment recordings are exposed honestly as ordered parts; the app does not concatenate unrelated containers.
- Optional synchronized slides were not implemented; core SFU, permission, recording, and private playback work took priority.
- Before production: apply/lint migrations in staging, configure narrow R2 CORS, verify private Realtime authorization, run Teacher + five receiver media scenarios, force grant/removal/end from a non-cooperating client, observe TURN relay, run multipart interruption/recovery, complete a two-hour recording and mobile replay matrix, compare counters with provider evidence, and obtain explicit enable/deploy approval.
