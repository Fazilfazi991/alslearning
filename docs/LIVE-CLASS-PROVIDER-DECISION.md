# ALS live-class architecture decision

Date: 5 September 2026

## Decision

ALS will validate a low-cost native classroom built from **Next.js + Supabase + Cloudflare Realtime SFU + Cloudflare R2**. The previous LiveKit Cloud recommendation is withdrawn. No alternate conferencing SDK is part of this direction.

The production Join Class action remains disabled until the POC has passed media, permission, recording, failure-recovery and bandwidth acceptance tests.

## Responsibilities

| System | Responsibility |
|---|---|
| Next.js | Classroom UI, authenticated server boundary, Realtime API proxy and R2 signing endpoints |
| Supabase Auth/Postgres/Realtime | Identities, trusted roles, batches, enrollment eligibility, schedules, presence, attendance, chat, polls, hand raising and publishing permissions |
| Cloudflare Realtime SFU | WebRTC peer connections and forwarding explicitly selected audio/video/screen tracks |
| Cloudflare R2 | Private class attachments, recording chunks/final recordings and other large objects |

Cloudflare Realtime deliberately supplies no room, participant, role or presence abstraction. ALS owns those concepts in Supabase and treats Cloudflare session/track IDs as ephemeral media routing state.

## Authentication and lifecycle

1. The browser authenticates with Supabase and requests a live-session join from Next.js.
2. The server verifies active enrollment and access dates, or verifies that the user is the assigned teacher/admin.
3. The server reads current publishing flags from `live_participants`; it never trusts a client-supplied role.
4. Only the server holds the Cloudflare App ID/secret and calls `POST /apps/{appId}/sessions/new`.
5. Each browser creates one `RTCPeerConnection`. Teacher tracks are published; student sessions normally subscribe only.
6. Track discovery IDs are stored in short-lived application state and shared only with eligible members.
7. Add/update/close/renegotiate calls are re-authorized. Leaving closes tracks/session state and records attendance.

## Media and permission model

- Teacher: microphone, 720p camera and screen share.
- Normal student: receive only; camera is disabled and microphone publishing starts disabled.
- Audio grant: teacher sets `audio_publish_allowed`; the student may then request and publish microphone audio. Revocation closes the audio track, not merely the UI control.
- Presenter grant: teacher sets `presenter` and `screen_publish_allowed`; the student may publish a screen track. Revocation closes it.
- PowerPoint, images, browser tabs and applications use `getDisplayMedia`. System/tab audio availability depends on browser and operating system.
- Camera and screen are separate video tracks. Simulcast should be evaluated for camera; screen content needs legibility-focused constraints and may not benefit from the same layers.

## Bandwidth and TURN

Cloudflare charges SFU/TURN egress from the edge to clients; publisher-to-Cloudflare traffic is not billed. As of this decision the published price is $0.05/GB with a shared 1,000 GB monthly SFU/TURN free tier. A broadcast classroom therefore grows approximately with `sum(received track bitrate) × receiver count × duration`. TURN can be necessary behind restrictive NAT/firewalls; Cloudflare STUN is free, and traffic crossing TURN plus SFU is not double charged.

## Browser compatibility and constraints

Realtime uses standards-based WebRTC, so target validation is required on current Chrome, Edge, Safari and Android/iOS browsers. Screen capture requires a secure context and an explicit user gesture. Browser/OS combinations vary in application-window selection and captured audio. Autoplay policies can require a receiver interaction before audio plays.

Important operational constraints currently documented by Cloudflare include 50 Realtime API calls per second per session, 64 tracks per API call, practical track counts constrained by bandwidth, and garbage collection after 30 seconds without media packets. Realtime is a programmable SFU and does not provide ALS with a finished classroom SDK.

## Recording direction and risk

The initial experiment uses teacher-side `MediaRecorder` with five-second chunks. A production version must compose the desired screen/camera/audio output, upload chunks using authenticated R2 multipart operations, persist each part, retry failed uploads, finalize only after integrity checks and retain recoverable partial chunks. Closing the teacher tab, device changes, lost screen capture and long sessions are material risks. Browser recording is not accepted for production until long-duration interruption tests prove recovery. Cloudflare's WebSocket video egress is currently low-frame-rate and is not a substitute for classroom recording.

## POC acceptance gate

The credential-gated `/live-poc/[sessionId]` route is isolated from normal Join Class. Acceptance requires one teacher and five real receiver sessions, stable camera/audio/screen tracks, enforceable student audio/presenter revocation, persistent Supabase chat/polls/attendance, authorized R2 attachment flow, recoverable chunked recording and measured WebRTC statistics. No unmeasured or local-only result counts as an SFU pass.

## Official sources

- [Cloudflare Realtime SFU overview](https://developers.cloudflare.com/realtime/sfu/)
- [Sessions and tracks](https://developers.cloudflare.com/realtime/sfu/sessions-tracks/)
- [Connection API](https://developers.cloudflare.com/realtime/sfu/https-api/)
- [Realtime SFU limits](https://developers.cloudflare.com/realtime/sfu/limits/)
- [Simulcast](https://developers.cloudflare.com/realtime/sfu/simulcast/)
- [Realtime pricing](https://developers.cloudflare.com/realtime/sfu/pricing/)
- [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [R2 uploads and multipart guidance](https://developers.cloudflare.com/r2/objects/upload-objects/)
