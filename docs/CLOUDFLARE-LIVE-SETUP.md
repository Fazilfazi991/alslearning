# Cloudflare live-class setup

## Realtime SFU

1. Create a Cloudflare Realtime SFU application in the ALS Cloudflare account.
2. Provide the application ID as server variable `CF_REALTIME_APP_ID`.
3. Provide its app secret/token as server variable `CF_REALTIME_APP_SECRET`.
4. Keep both variables server-only. Never prefix them with `NEXT_PUBLIC_`.
5. Configure the production and preview environments separately and rotate leaked/test credentials.
6. Run two-participant publish/subscribe, reconnect, camera, microphone, screen-share, and permission tests before enabling Join.
7. Create a separate Cloudflare TURN key and API token. Configure server-only `CF_TURN_KEY_ID` and `CF_TURN_KEY_API_TOKEN`; do not reuse the SFU application secret. ALS returns generated four-hour ICE credentials to an authorized participant.

The application must remain usable when these variables are absent; only media negotiation is disabled.

## R2

1. Create a private R2 bucket dedicated to ALS class recordings.
2. Create a bucket-scoped R2 API token with the minimum object read/write permissions.
3. Configure server variables `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET`.
4. Allow only exact ALS production/approved preview origins in bucket CORS. Permit `PUT` for signed multipart parts and `GET`/`HEAD` for authorized playback checks; allow `content-type` and required signed request headers; expose `ETag`. Do not use `*` for production origins.
5. Keep the bucket private. Deliver recordings using short-lived authorized URLs.
6. R2 normally aborts incomplete multipart uploads after seven days. Verify that lifecycle in the bucket. Shortening it reduces recovery time; increasing it retains chargeable uploaded parts longer. Do not add object-deletion retention without a separate ALS policy decision.
7. Test multipart create, signed part upload, retry, complete, abort, and private retrieval before enabling recording uploads.

Do not place actual IDs, tokens, or secrets in this document or source control.

## Activation checklist

- Apply `20260924085900_recording_status_values.sql` and `20260924090000_native_cloudflare_classroom.sql` to an explicitly identified non-production Supabase project first.
- Set `ALS_LIVE_POC_ENABLED=true` only for an isolated `provider='cloudflare-poc'` class during acceptance.
- Keep `ALS_LIVE_CLASS_ENABLED=false` and `ALS_LIVE_RECORDING_ENABLED=false` until their respective acceptance gates pass.

- Environment validation succeeds on the server.
- Student cannot request a media session for an ineligible class.
- Teacher publishing permissions are checked before issuing media API calls.
- R2 object names are scoped by session and recording IDs.
- Cloudflare and R2 credentials are absent from browser bundles and network responses.
- A validated recording is reviewed and explicitly published before student visibility; raw SFU has no managed-recording webhook.
- Supabase Realtime private-channel authorization is enabled and the `realtime.messages` policies from the migration are active.
- Five independent receivers and at least one observed `relay` candidate are recorded as evidence before production entry is enabled.

## Disable and rollback

Set all three ALS feature gates to `false` and redeploy configuration. This prevents new POC entry, ordinary media entry, and new recording operations while leaving schedules, chat data, recordings, and the rest of ALS intact. Existing WebRTC connections must still be ended with the class control before rollback; changing an environment flag does not terminate an already established connection. Database migrations are additive and should not be destructively rolled back while recording objects or classroom audit rows exist.
