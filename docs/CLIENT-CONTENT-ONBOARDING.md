# ALS client content onboarding

ALS data can be added through authenticated Admin screens or validated imports without code changes. Never use real student or faculty data in development fixtures.

## Recommended order

1. Create entrance exams and programs in **Programs & Syllabus**.
2. Add subjects, optional chapters, and topics. Chapterless topics are supported.
3. Create batches and set their program, dates, capacity, and status.
4. Ask faculty to complete the approved Supabase Auth invitation/OTP flow, then assign their existing profile to programs, subjects, and batches. The application does not create passwords.
5. Create or import student Auth accounts through an approved administrative process, then add enrollments with program, optional batch, start, expiry/no-expiry, and status.
6. Add external videos or upload private materials. Assign program, subject, optional chapter/topic, faculty, visibility, order, and download permission before publishing.
7. Add questions manually or import CSV. Resolve every validation error; invalid rows are not imported. Confirm taxonomy and answer keys before activation.
8. Build draft tests from the question bank, configure timing, attempts, availability, randomization, and review rules, assign batches, verify, then publish.
9. Add video checkpoints only after the video and question exist. Test direct-play video behavior with a non-production learner before publishing.

## Safeguards

- Slugs must be unique; dates display locally but timestamps are stored in UTC.
- Private files remain in `learning-content` and use short-lived signed URLs.
- Archive content with learning history. Delete only unused drafts.
- Teachers author only within explicit assignment permissions.
- Students need an active, started, non-expired enrollment.
- Answer keys are separate and never returned by pre-submission student queries.

## Inputs ALS still needs to supply

Confirmed program/exam mapping, complete syllabus, final faculty and student lists, batch dates, production videos/materials, question bank, test rules, and certificate policy. Leave ambiguous relationships unset until ALS confirms them.

## YouTube progress policy

YouTube embeds are treated as limited-tracking content until the official IFrame Player API is integrated and verified. They must not contribute automatic watched-time or completion percentages. ALS may enable an explicit learner completion action later if its completion policy accepts self-attestation. Direct HTML5 video remains the authoritative progress path.
