# Recruit assessments

This application uses MongoDB, not SQL or stored procedures. Startup runs the additive, repeatable `migrateAssessments()` migration in `src/db.js`. Deploy the backend before the frontend.

## Migration and existing records

- Adds `presentation_challenges` and `center_commitments`; existing topics, bookings, exams and evaluations remain in place.
- Existing topics without a challenge are grouped under **Legacy presentations**. Assigned topics keep their title and description and receive an instruction snapshot. No reference document content is imported.
- New assignments store `challengeSnapshot` on the existing assigned topic. Assigned topics cannot be edited or deleted; challenge definition edits apply only to future assignments. Deactivation excludes a challenge from future spins without hiding assigned instructions.
- Existing and newly saved exam grades are always visible to their recruit, including records with legacy hidden flags. Only the combined final score defaults to hidden. Administrators use **Final score visibility** in Exam Results to release or hide it per recruit. The recruit endpoint omits hidden totals, contributions and commitment scores entirely.
- Existing evaluations receive an evaluator role based on the currently stored user record, because the original role at submission was not recorded. Future evaluations record the submitting role and expected criterion count. Deleted historical evaluators use GA weight as fallback.
- New unique indexes cover challenge normalized names and one commitment record per recruit. Existing evaluation uniqueness `(presenterUserId, evaluatorUserId, attempt)` is preserved.
- Challenge assignment and catalog imports/edits use MongoDB transactions, requiring a replica set (including MongoDB Atlas). No production data is changed by the test suite.

## Scoring policy

Role weights live in `app_settings` under `assessment-weights`, defaulting to Admin 2 / GA 1. Admin weight must exceed GA weight. Admin changes are audited and recalculate reports using the evaluator role recorded on each evaluation.

Each complete evaluation is normalized using its saved criteria snapshot. Partial or invalid records do not contribute. A given evaluator counts once per attempt. Presentation score = sum(score × role weight) / sum(role weight).

The existing attempt policy remains: an enabled, scored second attempt replaces attempt one. If no complete second-attempt evaluation exists, attempt one is used. Reports identify the selected attempt and show both attempts' evaluators.

Final score = exam normalized to 100 × 40% + presentation × 40% + commitment × 20%. Zero is a valid score. Any missing component makes the final score incomplete. Calculations retain full precision until display rounding to two decimals. All final calculations run on the backend.

Commitment changes append to the same document's history atomically. Final-score visibility and evaluator weight changes also retain history.

## Administration

Use Presentations → Challenges & topics to create or edit challenges and their topics. Download the Excel template, fill one topic per row (repeating the same challenge description and instructions), upload to preview, then confirm. The import validates again on confirmation and commits all rows together. Limits: `.xlsx`, 2 MB, 500 topic rows. Duplicate topic titles within a challenge, conflicting challenge definitions and missing required fields are rejected. Existing challenge definitions must match exactly to add new imported topics to them.

Exam Results → Recruit reviews & final results includes all recruit accounts, even those without assignments. Enter commitment, configure weights, release/hide final scores, open an individual report, export all/individual Excel reports, or print. Recruits see Exam, Presentation and Final Score sections here. The Presentations page retains criterion-level evaluation reports and the existing year filter; overall assessment reports use each recruit's persistent assignment and assessment records.

Recruits see only their own assignment and booking details; other occupied slots remain unavailable without disclosing the occupant. Evaluators use the existing presentation module access and can only save their own evaluations. Admin-only routes recheck the current database role on every request.

## Verification

`npm test --prefix backend` runs deterministic scoring tests. The integration test skips unless explicitly pointed to the isolated local replica set:

```sh
ASSESSMENT_TEST_MONGO_URI='mongodb://127.0.0.1:27139/?replicaSet=assessment-test' npm test --prefix backend
```

Start a disposable `mongod` bound to 127.0.0.1 on port 27139 with `--replSet assessment-test` and a temporary data directory first. The test initializes that set, creates and removes a uniquely named test database, and never starts notification schedulers. It checks migration, concurrency, reservations, scoring, privacy, role revocation, Excel import and export.

Optional browser coverage: start Vite and set `ASSESSMENT_UI_URL` to its local URL and `ASSESSMENT_PLAYWRIGHT_PATH` to the installed Playwright module. Browser checks use Google Chrome on macOS, route API traffic to the isolated test API, and save screenshots in `/tmp/assessment-*.png`.
