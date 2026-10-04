# Cloudflare native live-class POC acceptance

Date: 24 September 2026 (Asia/Dubai)

Scope: isolated local ALS application and local Supabase only

Cloudflare account scope: `als-live-poc-sfu`, `als-live-poc-turn`, and private Standard R2 bucket `als-live-poc-recordings`

## Outcome

| Requirement | Result | Measured evidence |
| --- | --- | --- |
| Realtime subscription | PASS | Activated only Cloudflare Realtime on the approved account and card ending 0391. Checkout remained $0 due now, $0 fixed monthly base, 1,000 GB/month shared SFU/TURN allowance, then $0.05/GB. No RealtimeKit or Stream subscription was created. |
| R2 credential and CORS | PASS | One user-scoped Object Read & Write credential is restricted to `als-live-poc-recordings`, active 24 Sep-1 Oct 2026. Its secret is stored only in ignored, DPAPI-protected local configuration. CORS permits only `http://127.0.0.1:3000`, methods `GET`, `PUT`, `HEAD`, headers `Content-Type`, `Range`, exposes `ETag`, and uses 3,600-second max age. Public access remains disabled. |
| Allowance check and batch safeguard | PASS | Shared allowance showed 1,000 GB available before media generation. Application RTP summaries contain 45 samples and 227,380,747 aggregate payload bytes (about 0.227 GB): 45,078,967 audio, 182,301,780 video, and 0 in the screen-specific counter. This is below the 10 GB internal stop threshold. Cloudflare billing data was not used as a real-time cap. |
| Initial Teacher + Student SFU | PASS | Student received about 62 kbps audio and 452 kbps video with 19 ms RTT and zero loss in the acceptance interval. Direct host-path media was observed. |
| Five-receiver acceptance | PASS | One Teacher plus five Students connected. Receivers measured about 64-65 kbps audio, 432-469 kbps video, 16-35 ms RTT, and zero loss during the acceptance interval. |
| Teacher audio/video/screen delivery | PASS | Real SFU audio/video was received. Teacher screen share was received at 1920x708. The UI's generic video counter carried the screen traffic while the dedicated screen counter remained zero; this is an instrumentation classification defect, not missing media. |
| TURN relay | PASS | With the POC-only relay gate enabled, Teacher media measured about 65 kbps audio, local candidate `relay`, 137 ms RTT, zero loss; Student measured about 64 kbps audio, local candidate `relay`, 17 ms RTT, zero loss. The relay gate was disabled after the run. |
| Student microphone grant and forced revocation | PASS | In the final 1+1 run the Student published a real Cloudflare microphone track. Teacher inbound audio measured 115 kbps at 32 ms RTT. Revocation closed the publication; the final database state was zero active Student microphone tracks and `audio_publish_allowed=false`. |
| Student presenter grant and forced revocation | PASS | Student published a real Cloudflare screen track. Teacher playback reported 1920x708, ready state 4, and actively playing. Revocation reported `1 publication(s) terminated`; the final database state was zero active Student screen tracks and `screen_publish_allowed=false`. A local Next.js development overlay appeared after reception, and reloading the Teacher control surface recovered it before revocation. |
| Participant removal | PASS | Forced Student removal ended the peer, showed the removal state, set `removed_at`, and closed the media connection. The synthetic fixture was reset only for the later microphone/presenter acceptance. |
| Teacher-only recording | PASS | Real canvas-composed Teacher capture was 44.500 seconds, 2,066,298 bytes, 1280x720, audio and video present. It was uploaded to the private R2 object under `recordings/2026/09/.../teacher-composite.webm` as a one-part multipart upload with stored ETag and verification metadata. |
| Interrupted upload recovery | PASS | The initial browser WebM duration probe returned infinity and left persisted recovery data. The completed-upload reconciliation and finite-duration probe resumed the same object without re-uploading it; validation then reported 44.500 seconds, seekable, audio present, and video present. |
| Admin review and publication | PASS | Admin played the actual signed R2 object, observed 1280x720 playback, sought by about 10 seconds, renewed the signed URL while preserving about 21.7 seconds of playback position, approved the recording, and published it. |
| Eligible Student playback | PASS | Eligible Student listing showed the published replay. Playback used the actual signed R2 object. Seeking moved playback from about 4.65 to 12.02 seconds, and signed-URL renewal changed the URL while preserving playback position. |
| Timed shutdown and cleanup | PASS | All test browser peers, provider tracks, publishers, receivers, and retry loops were stopped. Final local state was 0 active connections, 0 active tracks, and 0 active subscriptions. Port 3000 was closed. No live feature variable remains set in `.env.local`, so all live gates resolve to their disabled defaults. |

## Observations retained for follow-up

- The screen media is currently counted by the generic video statistic rather than `screen_bytes`; the successful 1920x708 receive-side playback is the acceptance evidence.
- Historical cleanup evidence is preserved locally as 9 failed track rows and 18 failed subscription rows from provider-close timeouts. They have no retry schedule and are not active connections or active media. Later leave/replacement flows closed their active rows successfully.
- During the final presenter test, the Teacher page displayed a Next.js development overlay after receiving the screen. Reload restored the authenticated Teacher controls, and the forced provider revocation then succeeded. This was not observed as a hosted or production failure because no hosted environment was used.
- R2 account storage displayed about 3.56 GB before this test. The POC recording added about 2.0 MiB. The application RTP counters are not Cloudflare billing records and do not replace provider usage reporting.

## Remaining external state

- Cloudflare Realtime subscription: active under the approved recurring usage terms.
- `als-live-poc-sfu`: retained.
- `als-live-poc-turn`: retained.
- `als-live-poc-recordings`: retained as a private Standard bucket; public access disabled.
- R2 scoped credential: retained and expires 1 October 2026; no secret value is recorded here.
- Usage warnings: existing $10 notification preserved; additional $1 and $5 warnings active for the verified account-owner email. These are warnings, not spending caps.
- Recording and interrupted-upload recovery evidence: retained locally and in the private R2 bucket.

## Production boundary

ALS Production was not changed. No hosted staging environment was created or resumed. No branch was pushed, merged, or deployed. Production live-class flags were not enabled, and no additional service was purchased.
