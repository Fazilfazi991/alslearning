# Cloudflare live-class setup

## Realtime SFU

1. Create a Cloudflare Realtime SFU application in the ALS Cloudflare account.
2. Provide the application ID as server variable `CF_REALTIME_APP_ID`.
3. Provide its app secret/token as server variable `CF_REALTIME_APP_SECRET`.
4. Keep both variables server-only. Never prefix them with `NEXT_PUBLIC_`.
5. Configure the production and preview environments separately and rotate leaked/test credentials.
6. Run two-participant publish/subscribe, reconnect, camera, microphone, screen-share, and permission tests before enabling Join.

The application must remain usable when these variables are absent; only media negotiation is disabled.

## R2

1. Create a private R2 bucket dedicated to ALS class recordings.
2. Create a bucket-scoped R2 API token with the minimum object read/write permissions.
3. Configure server variables `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET`.
4. If browsers upload presigned parts directly, allow only the ALS production/preview origins and required `PUT`, `GET`, and `HEAD` methods in bucket CORS.
5. Keep the bucket private. Deliver recordings using short-lived authorized URLs.
6. Add lifecycle rules for abandoned multipart uploads and any ALS-approved recording retention policy.
7. Test multipart create, signed part upload, retry, complete, abort, and private retrieval before enabling recording uploads.

Do not place actual IDs, tokens, or secrets in this document or source control.

## Activation checklist

- Environment validation succeeds on the server.
- Student cannot request a media session for an ineligible class.
- Teacher publishing permissions are checked before issuing media API calls.
- R2 object names are scoped by session and recording IDs.
- Cloudflare and R2 credentials are absent from browser bundles and network responses.
- Webhook signatures and recording publication states are verified before student visibility.
