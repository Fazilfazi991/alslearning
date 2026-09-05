# ALS academic infrastructure audit

## Before this batch

### Already functional

- Responsive Next.js 16 routes, layouts and approved visual system.
- Client-side navigation and UI interactions in Student, Teacher and Admin portals.
- Typed local demonstration data and optimized local course imagery.

### UI only

- Login, course enrollment/access, video progress, exams/results, notifications, payments and certificates.
- Admin CRUD screens, teacher content tools, live classroom controls and simulated assessment submission.
- Every portal consumed `src/lib/mock-data`; no request reached a database.

### Partially functional

- Academic cards and lesson/exam experiences behaved interactively in the browser but did not persist.
- Admin forms displayed success states without a backend mutation.

### Missing

- Authentication/session backend, database, migrations, RLS, private storage policies and server authorization.
- Entrance-exam/program hierarchy, optional chapter/topic taxonomy, many-to-many faculty mappings and enrollment validity.
- Central question model, validated bulk import, reusable configurable test engine and attempt persistence.
- Video checkpoints, live questions, conferencing provider, recording lifecycle and controlled recording publication.

### Needs schema extension

- All academic and access models were absent, rather than merely needing columns added.

## Added foundation

- `supabase/migrations/20260905044506_academic_platform_foundation.sql` is the source of truth for the new domain.
- Admin Programs & Syllabus supports create, edit, archive, delete-draft, reorder, search and parent association using a clearly labelled local draft until Supabase is connected.
- Question Bank supports extensible question types, source metadata, search/filter, manual entry, CSV template download, validation review and valid-row-only import.
- Email OTP uses Supabase Auth when configured, with resend cooldown and explicit development fallback.
- Live-class capabilities are modeled behind a provider interface; they are not represented as working without provider credentials.

## Deployment prerequisites

1. Create/link a Supabase project and apply the migration in a staging environment.
2. Configure URL and publishable key from `.env.example`; never expose service/provider secrets.
3. Set `app_metadata.role` for admin/teacher accounts from a trusted server or dashboard.
4. Configure email OTP expiry/rate limits in Supabase Auth and validate permitted redirect URLs.
5. Select and implement a production live-class provider adapter, webhook verification and recording delivery.
6. Run database policy tests/advisors against the linked project before launch.
