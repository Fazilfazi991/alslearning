# ALS live-class bandwidth POC

Date: 5 September 2026

## Measurement status

No Cloudflare Realtime App credentials or R2 credentials are configured, so no SFU traffic has been generated and there are **no measured bitrate values yet**. Zeroes shown in the contained POC are explicitly not measurements. Monthly totals are therefore intentionally not fabricated.

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

The multipliers above convert Mbps into GB using the stated formula. Teacher ingress is not included because Cloudflare currently bills SFU traffic originating at the edge toward clients. Any return student-audio egress must be added using its measured duration and receiver count. Compare the final total with Cloudflare's current 1,000 GB monthly free tier and $0.05/GB overage; recheck pricing before a production decision.

Source: [Cloudflare Realtime pricing](https://developers.cloudflare.com/realtime/sfu/pricing/).
