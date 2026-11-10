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
