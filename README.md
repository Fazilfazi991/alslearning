# ALS — Academy for Laboratory Science

A premium, responsive laboratory-science learning platform built with Next.js, React, TypeScript, and Tailwind CSS.

## Demo preview

![ALS learning platform course-player preview](docs/als-learning-demo-preview.png)

## Student experience

- Public academy homepage and demo sign-in
- Student dashboard and course catalogue
- Clinical Biochemistry course overview and learning player
- Supabase-authorized live classes with a feature-gated Cloudflare Realtime SFU classroom and private R2 recording playback
- Exams, question navigation, review, and results
- Learning progress and topic-performance reporting
- Certificates, notifications, and help centre
- Responsive desktop, tablet, and mobile navigation

Academic, authentication, classroom, and recording state use Supabase. Native live media and R2 recording remain disabled by default until the staged acceptance gates in `docs/LIVE-CLASS-IMPLEMENTATION-AND-ACCEPTANCE.md` pass.

## Run locally

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Validation

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Technology

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS
- Lucide icons
- Next/Image optimized local assets
