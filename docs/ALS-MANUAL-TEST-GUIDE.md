# ALS protected staging: manual test guide

**Site:** https://darkgreen-camel-484366.hostingersite.com/
**Environment:** isolated ALS Hostinger staging application and Supabase project `als-live-staging` (`slghshcdaijbcjfoqerq`). This guide is for synthetic testing only. It does not describe the Production ALS site.

## Access and test accounts

1. Open the site URL above in a private browser session. The protected site first shows `/_staging-access`.
2. Obtain the staging access phrase from the release owner through the approved private channel. On the owner's configured workstation it is stored in the ignored `../als-hostinger-staging/.env.hostinger.live.local` file, relative to this integration checkout. Enter the phrase into the form; do not put it in the URL.
3. Sign in with a **different synthetic account for each role**. The existing account passwords are in the owner's ignored `../als-hostinger-staging/.env.staging.accounts.local` file, under the matching `ALS_STAGE_*_PASSWORD` entries. The two primary students are `als-staging-student1@example.test` and `als-staging-student2@example.test`; use `als-staging-teacher@example.test` for Teacher and `als-staging-admin@example.test` for Admin. Ask the release owner to provide each password privately if you do not have access to that secure file.
4. Additional roster/denial accounts, when specifically needed, are documented in the ignored `.local-qa/als-manual-demo-v1/additional-accounts.json` on the owner's workstation. It contains credentials; do not copy it into this repository, a ticket, screenshot, or chat.
5. Sign out before changing roles, or keep roles in separate private browser contexts. Never use a Production account for these checks.

The credential files above are local and ignored. This guide intentionally contains no phrase, password, token, cookie, signed media link, or secret file contents.

## What is in the synthetic pack

| Item | Expected fixture |
| --- | --- |
| Populated programs | **Synthetic ALS Staging Classroom** and **ALS Demo Diagnostic Foundations**. Student 1 also has a separate active, unconfigured CRE Crash Course enrollment; keep it intact. The Student dashboard may therefore show more than two eligible programs. |
| Subjects | **Synthetic Laboratory Science** and **Demo Laboratory Safety** in the staging classroom program; **Demo Diagnostic Reasoning** in Diagnostic Foundations. |
| Learning items | Six small synthetic materials across those subjects: five published and one draft. The published examples include a private PDF guide, image, 45-second video, note and document. The draft is not a Student resource. |
| Questions | Eighteen synthetic questions across the three subject scopes, including drafts. An authorized Teacher has assignments for all three scopes. |
| Tests | Four active catalog tests plus one draft: **Synthetic Demo Practice** (available), **Synthetic Upcoming Assessment** (future opening), **Synthetic Demo Graded Result** (Student 1 has a real server-graded synthetic submission), **Synthetic Closed Assessment** (past closing), and **Synthetic Draft Assessment** (hidden from Students). These are optional demonstrations, not required coursework. |
| Classes | Two synthetic scheduled academic examples and one completed historical example persist. Scheduled handoff examples: 2 and 3 October, 12:00–12:10 Asia/Dubai (08:00–08:10 UTC), media still blocked. Their scheduled times are fixture times, so use the current on-screen status; do not assume a seeded class remains joinable. A real media trial must use a **fresh** class. |
| Class recording | The retained historical media fixture is **validating and unpublished**. It is evidence for review workflow only and is **not** a Student replay. No new hosted screen recording has been accepted. |

An additional genuine Teacher-authored question and **Synthetic Hosted Teacher Authoring Acceptance** test persist. Student 1 completed that test at 1/1 in hosted acceptance. Expected current totals: Teacher 19 questions / 6 assessments / 6 materials / 7 enrollment rows; Student 1 3 eligible programs / 2 upcoming academic classes / 2/5 completed, 7/7 visible marks, 1 test to take and 44.013 seconds watched; Student 2 0/5 completed, 3 tests to take and no playback history. These values change when you make new attempts or watch lessons.

The latest idempotent fixture rerun reported **68 skipped, 0 created, 0 updated**. Fixture labels identify synthetic content. Existing Student attempts and owner edits are preserved on rerun.

**Primary academic access expiry (UTC): 2026-10-08T07:40:22.181Z**
**Same instant in Asia/Dubai: 8 October 2026, 11:40:22.181 (UTC+04:00)**

The five existing active primary Student enrollment rows have a separate seven-day academic period beginning 2026-10-01T07:40:22.181Z, verified against the protected access policy. A separate expired Student fixture is deliberately retained for denial testing. Academic access expiry is separate from any live-media window.

## Student journey

1. Sign in as **Student 1**. Open **Home**. Check that the welcome name, distinct eligible programs, upcoming scheduled classes, actual native watch time, tests completed/total, tests to take, and visible marks match the currently accessible records. An available repeat of a submitted test is not a new pending obligation. A test that is future, closed, inaccessible, exhausted, or already submitted must not be counted as “to take.” Watch time says No history yet unless actual playback intervals exist; seeking or pausing must not increase it.
2. Open **My Courses**. Select **Synthetic ALS Staging Classroom** and confirm its two named subjects, the published materials, and meaningful progress. Open the PDF and image; play the short native video. Return to **Progress** and confirm that any watch time comes from playback, not from the saved resume position. Open **ALS Demo Diagnostic Foundations** and confirm **Demo Diagnostic Reasoning** and its material. The separate CRE enrollment can appear without demo subjects; do not treat it as a missing subject in either populated program.
3. Open **Exams & Quizzes**. Check the Available, In Progress, Completed, and Upcoming tabs. **Synthetic Upcoming Assessment** must say it is not open yet; **Synthetic Closed Assessment** must not offer a fresh start. Open **Synthetic Demo Practice**, start only if you intend to create a real synthetic attempt, answer and submit; reload to confirm persistence and server grading. For Student 1, open **Synthetic Demo Graded Result** and inspect the existing synthetic result. Hidden results must not disclose marks or answer keys.
4. Open **Live Classes**. Scheduled and completed states should be clear. With the current media block, no working Join or new recording action should be expected. A replay link should appear only for a genuinely published recording, not the validating historical fixture.
5. Check **Notifications**, **Profile**, and **Logout**. Repeat the layout on a 390 px mobile viewport: bottom navigation and More should remain usable, cards should stack, and the page should have no horizontal overflow. Keyboard focus should reach actions and forms.

Student 2 can confirm the same assigned demo courses without assuming Student 1's saved test history or watch time. Use the expired negative-test Student only to confirm denial of restricted academic content.

## Teacher journey

1. Sign in as the synthetic **Teacher**. Open **My Courses** and **Students**. Confirm the two populated demo programs, assigned subjects/batches, and the intended synthetic roster. An unassigned Teacher test account should not gain authoring or unrelated Student access.
2. Open **Study Materials**. Find the synthetic PDF, image, video, note and document under their subject scopes. Open the published PDF/video and check the material content. A draft should remain unavailable to Students.
3. Open **Question Bank**. Click **Add question**, then select the assigned Exam, Program and Subject in the editor. Enter a clearly synthetic prompt, options and correct answer, then **Preview question** and **Save question**. Use **View saved question** if the active filters hide it. Clear filters or search the exact prompt, reopen it, edit one safe field, save and reopen again to verify persistence. Keep the question within an assigned scope.
4. Open **Assessments**. Create a **draft** synthetic test in the same Program/Subject, choose manual questions including the newly saved active question, set a short duration and bounded availability, then **Preview test**. If you intentionally make it available to the synthetic Student, set status Active and **Save test**. Confirm Student access and server-graded submission in that Student's separate session. Do not edit the seeded result test merely to exercise the form.
5. Open **Live Classes**. Scheduled details should remain visible while media is blocked. Check one desktop and one 390 px view for a single usable Logout control in the responsive navigation.

## Admin journey

1. Sign in as synthetic **Admin**. Open **Programs & Syllabus**, **Enrollment Management**, and **Faculty Management**. Confirm canonical Program-to-Subject mappings and Teacher assignments. Check that the two primary Students have independent Program enrollment rows. Editing one enrollment should not overwrite another; use **Add another program** to add separate access if a further synthetic enrollment is explicitly needed.
2. Open **Question Bank** or the academic management views to verify the Teacher's newly saved question and test in the intended scope. Do not expose raw answer keys to a Student account.
3. Open **Native live classes**. The historical class and scheduled examples should show their real states. The retained historical recording is validating/unpublished; do not press Publish or tell a Student it is ready. The **Recording review** area becomes actionable only when a genuine recording has Teacher playback evidence and the Admin has inspected every segment.
4. Check one desktop and one 390 px view for a single responsive Logout control, readable forms, and no page-level horizontal overflow. Sign out.

## Live class and replay: later, only after a new approved media window

**Current status: BLOCKED.** The conservative R2 credential guard was `2026-10-01T00:00:00Z`; the provider only stated a 1 October end date, not an exact expiry hour. The owner declined renewal for this handoff. A real unattended provider-track closure path remains unverified. The prior class proved microphone receipt but did not establish Student screen frames or a hosted recording. The validating historical fixture is unpublished and not replay-ready. None of the steps below is marked PASS.

If the owner later approves a bounded window, the release owner must first verify exact provider/R2 credential validity, account headroom, the site origin and cleanup mechanism, and publish a start/end time and duration limit. Restrict it to **one Teacher and at most two Students**, a fresh synthetic class, and a short session of **10 minutes or less**. Do not start with a completed fixture or leave the session unattended.

1. Admin schedules a **fresh** native class against the assigned Teacher, Program, Subject and active batch, with recording enabled and a short end time. Prepare separate Teacher and Student browser sessions before starting.
2. Teacher opens **Live Classes → Start or join class → Start class**. Join with microphone, leave camera off unless specifically needed, then use the browser's normal native screen-share chooser to select the safe teaching tab. Confirm the tab selection and published screen status; the chooser needs a deliberate human selection.
3. Student 1 and, if needed, Student 2 use their own sessions to join normally. Confirm audible Teacher audio and readable **received** teaching frames on each Student screen, rather than relying on the Teacher's local preview. If permission is cancelled, use the displayed retry path. Keep Student microphone/camera receive-only unless an approved grant changes that.
4. Teacher clicks **Start recording** only after microphone and screen are both published. Teach briefly, click **Stop recording**, wait for upload/validation feedback, then end the class and leave. Confirm all participants and media connections close.
5. Admin opens **Native live classes → Recording review** for that new class. Play and seek every segment; verify audio, teaching visuals, intended content, no private classroom panels, and actual private upload. Use **Approve after playback review**, then **Publish** only if verification succeeds.
6. Student opens **Live Classes → Replay lesson** and checks playback, seeking and signed-link renewal where applicable. The replay should remain limited to eligible Students. Record the exact outcome, including any failure. A local video file or imported historical object does not prove a new hosted capture.

If the window closes or an operational guard fails, stop new entries and recording; the release owner must check actual provider closure and cleanup. Do not re-enable media merely because the academic pages are available.

## Staging fixture maintenance

Only the release owner should run fixture maintenance. Run from the **staging integration source root**, after confirming no live session, upload or owner media activity. `<secure-config-dir>` must contain the ignored `.env.staging.local` and `.env.staging.accounts.local` files; `<secure-management-env>` is a separate private file containing the management token. Do not print either file. The runner verifies the exact Supabase project ref/name/organization/health and a quiet media state before mutation.

```powershell
node scripts/als-manual-fixtures.mjs seed "<secure-config-dir>" "<secure-management-env>"
node scripts/als-manual-fixtures.mjs renew-access "<secure-config-dir>" "<secure-management-env>"
```

`seed` is the idempotent synthetic pack maintenance mode; it preserves existing records and attempts. `renew-access` is a **separate, explicit** seven-day primary-Student enrollment renewal, never a page-load or seed side effect. Do not run it merely because an expiry is near. Confirm the new UTC expiry and Asia/Dubai display value from the protected output before updating this guide. Keep the expired negative-test fixture expired.

## Report a defect

Record the role, account label **without password**, hosted URL/path, UTC time, device/browser and viewport, exact clicks, expected versus observed result, and a screenshot with personal data and tokens redacted. For a data discrepancy, include the visible Program/Test/Content title and the relevant fixture ID from the protected manifest if available; do not attach a database dump. For media, add whether the Teacher published microphone/screen, whether the Student actually received audio/frames, the recording state, and whether all connections closed. Distinguish a blocked test from a failed one, and do not label a local check as a hosted PASS.
