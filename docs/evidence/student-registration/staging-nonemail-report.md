# Staging non-email registration check

The registration feature was exercised against the protected staging deployment using dedicated synthetic test data. No invitation emails were sent. These results do not establish production readiness.

- The mobile form loaded, required fields prevented progression, and a synthetic application received a confirmation.
- An exact submission retry succeeded without duplication; a changed payload using the same retry key was rejected.
- Unauthenticated admin API access was denied. The synthetic applicant had no student profile before approval.
- The staging administrator approved the application. The resulting student record had a permanent Student Code and the selected program and batch; the setup link remained unsent. A repeated approval was rejected.
- The dedicated one-seat test batch showed 1/1 after approval. A second synthetic application's direct approval attempt returned 409; the application remained pending and had no linked student or student profile.
- An initial immediate UI assertion saw the full-batch option enabled. A later read-only check showed both admin detail APIs reporting 1/1 and the browser option disabled. The cause of the first observation has not been established and requires investigation before release.

Five screenshots of synthetic-only mobile and admin screens and a detailed private fixture report remain under the ignored local QA directory. Test fixtures were retained for the agreed cleanup procedure; no existing records were deleted. Hosted Auth-orphan verification for the second applicant remained pending when this report was written.

Email delivery, invitation redemption, password setup, student login, and actual simultaneous hosted approvals were not tested in this non-email staging run. Local isolated tests do not replace those hosted checks.

## Recheck after the reserved-seat safeguard

The recheck used the same two synthetic applications after the third staging migration and updated preview. It did not create another application or Auth account, and sent no email. The protected preview's runtime target was independently matched to staging using its public program list.

- Mobile required-field validation and denial of unauthenticated admin API access passed.
- An exact retry of the existing pending application succeeded, a changed retry was rejected, and the admin search still showed one application.
- The previously approved student retained the Student Code and assigned program/batch; the setup link remained unsent. The other application remained pending and unlinked.
- Admin review showed the one-seat test batch as full with one seat reserved and disabled the option. A direct approval attempt returned 409 and left the applicant pending without a student profile.

The initial short-lived enabled observation above cannot be causally explained by this recheck. Two synthetic-only recheck screenshots and a private fixture report are kept in the ignored local QA directory. The temporary test admin's global sessions were revoked, its Auth account re-banned, and a fresh login rejected. Its profile was subsequently set inactive and verified in Chrome; the guarded update affected only that marked account. Test applications, enrollment and batch remain labelled for a separate agreed cleanup.

This recheck does not test real email, password setup, student login, hosted concurrent approvals or production configuration.
