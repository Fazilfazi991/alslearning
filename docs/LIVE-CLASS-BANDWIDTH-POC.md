# ALS live-class bandwidth POC

Date: 24 September 2026

## R2 recording upload boundary

The server-only adapter in `src/lib/live-class/recording-storage.ts` implements multipart start, short-lived signed part URLs, provider reconciliation, exact ETag/size validation, completion, object `HEAD`, abort, and signed playback. The browser assembles fixed 8 MiB non-final parts from irregular MediaRecorder events and stores ordered source chunks in IndexedDB. R2 credentials and upload IDs never become browser-selected authority.

Objects use `recordings/YYYY/MM/{sessionId}/{recordingId}/{segmentId}/teacher-composite.{webm|mp4}` and remain private. Playback uses a 15-minute signed bearer URL after a fresh ALS eligibility/publication check. The URL is not DRM and remains usable until expiry. Required server variables are `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET`. Provider success is not claimed until a real upload and seek test passes.

## Measurement status

The code samples WebRTC RTP payload byte counters every two seconds and persists a low-frequency summary approximately every 30 seconds. No real Teacher-plus-five-receiver Cloudflare run was performed in this implementation session, so there are **no measured provider bitrate, TURN, or invoice values yet**. An empty usage table is “provider usage unavailable,” not evidence of zero usage.

## Required measurement method

Run one teacher publisher and five independent student receivers through Cloudflare Realtime. Sample `RTCPeerConnection.getStats()` every two seconds and calculate bitrate from byte deltas, separately for teacher audio, 720p camera, screen share and each receiver. Record median, p95, packet loss, resolution, frames per second and whether the selected candidate used relay/TURN. Cross-check Cloudflare application/session usage after the run.

Use at least three 20-minute samples: camera plus microphone, mostly static PowerPoint, and motion/video screen sharing. The estimate must use the measured mix ALS expects, not a codec target bitrate.

## Calculation template

Let `R` be measured average downstream megabits/second received by one student for the agreed media mix. Estimated SFU egress in decimal GB is:

`GB = R × 3600 × class hours × students ÷ 8 ÷ 1000`

| Scenario | Calculation awaiting measured R | Result |
|---|---:|---:|
| A: 20 students, 20 hours/month | `R × 180` | Pending POC |
| B: 30 students, 40 hours/month | `R × 540` | Pending POC |
| C: 50 students, 40 hours/month | `R × 900` | Pending POC |

The current ALS planning reference adds 20% headroom: `0.45 × 1 Mbps × 50 × 40 × 1.20 = 1,080 GB`. With the dated, configurable assumptions of a shared 1,000 GB allowance and `$0.05/GB`, estimated SFU overage is `$4.00`. A 240-hour, 1 Mbps recording library is `108 GB`; after an entered 10 GB R2 allowance at `$0.015/GB-month`, the storage estimate is `$1.47`. Combined: `$5.47/month` for only these two modeled meters. This is neither a subscription quote nor an invoice.

The multipliers above convert Mbps into GB using the stated formula. Teacher ingress is not included because Cloudflare currently bills SFU traffic originating at the edge toward clients. Any return student-audio egress must be added using its measured duration and receiver count. Compare the final total with Cloudflare's current 1,000 GB monthly free tier and $0.05/GB overage; recheck pricing before a production decision.

Sources checked 24 September 2026: [Cloudflare Realtime pricing](https://developers.cloudflare.com/realtime/sfu/platform/pricing/) and [R2 pricing](https://developers.cloudflare.com/r2/pricing/). Recheck both before enablement.
