# ALS live-class provider decision

Date: 5 September 2026

## Decision

Recommend **LiveKit Cloud** for the first production proof of concept, while preserving the existing `LiveClassProvider` boundary so ALS can switch to Zoom Video SDK if operational testing shows LiveKit does not meet classroom moderation needs.

No provider has been purchased or integrated in this batch.

## Requirements

ALS needs browser-based two-way camera/microphone, teacher moderation, temporary student presenter rights, screen and PowerPoint sharing, shared video/audio, chat, recording, webhook-driven recording status, and mobile-browser support.

## Comparison

| Provider | Fit | Advantages | Risks / cost notes |
|---|---|---|---|
| LiveKit Cloud | Recommended for POC | WebRTC-first SDK, explicit participant permissions, screen sharing, data channels for classroom events, webhook support, and composited/participant recording through Egress. Can also be self-hosted later. | More classroom UI and moderation behavior must be built by ALS. Current cloud pricing includes 5,000 WebRTC participant minutes and 60 shared recording/import minutes on the free tier; paid Ship begins at $50/month, with usage charges after allowances. |
| Zoom Video SDK | Strong managed alternative | Mature host/manager roles, mute/remove/share controls, web/mobile SDKs, chat, screen and system-audio sharing, cloud recording, REST APIs, and webhooks. Familiar classroom behavior. | Video SDK and recording require a paid credit/storage plan. UI customization and browser/WASM requirements need a POC on ALS target devices. |
| Daily | Viable fast-launch option | Good browser SDK, prebuilt UI option, recording, screen sharing, and lower implementation effort for an initial classroom. | Presenter/moderation workflows need validation against ALS's exact role model; pricing should be rechecked using expected participant minutes. |
| 100ms | Viable role-oriented option | Role and permission model maps naturally to teacher/student/presenter, with recording and screen sharing. | Smaller ecosystem than Zoom; browser compatibility, recording output, support, and regional quality should be validated in a timed POC. |

## Why LiveKit first

1. Its permission/token model maps cleanly to the existing server-side `teacher`, `student`, and `presenter` roles.
2. Classroom polls and hand-raise events can use the same room data channel while canonical records remain in Supabase.
3. Egress supports a webhook-driven `requested → recording → processing → ready/failed` lifecycle.
4. It avoids coupling ALS academic data and authorization to a conferencing vendor.
5. Its free allowance is sufficient for a technical POC before ALS approves paid usage.

## Required POC acceptance tests

- Chrome, Edge, Safari and Android/iOS browser joins.
- Teacher can mute/remove users and revoke publish/screen-share permission.
- A student can be promoted to presenter, share PowerPoint via screen sharing, include tab/system audio, then be demoted.
- Teacher and presentation media continue simultaneously.
- 25-50 participant classroom network test in the intended region.
- Recording includes teacher, participating students and shared screen; signed webhook updates the Supabase recording row.
- Recordings remain unavailable until processing is `ready` and an authorized teacher/admin publishes the linked content.
- Cost projection using ALS's expected classes, duration, participant count and recording retention.

## Sources

- [LiveKit pricing and included WebRTC/recording usage](https://livekit.com/pricing)
- [LiveKit screen sharing](https://docs.livekit.io/transport/media/screenshare/)
- [LiveKit Egress recording](https://docs.livekit.io/transport/media/ingress-egress/egress/)
- [Zoom Video SDK features and platforms](https://developers.zoom.us/docs/video-sdk/)
- [Zoom session roles and moderation](https://developers.zoom.us/docs/video-sdk/web/sessions/)
- [Zoom screen sharing](https://developers.zoom.us/docs/video-sdk/web/share/)
- [Zoom cloud recording](https://developers.zoom.us/docs/video-sdk/web/recording/)
- [Daily Video SDK pricing](https://www.daily.co/pricing/video-sdk/)

## Implementation boundary

Provider credentials must remain server-side. The application must mint short-lived join tokens only after validating the Supabase session, role, batch eligibility and live-session record. Provider webhooks must be signature-verified before recording state changes.
