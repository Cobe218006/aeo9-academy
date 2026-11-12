# Hiring View

A signed-in learner's own evidence summary (tab "Hiring View"), built by `src/lib/evidence.ts` from data the learner already owns.
No schema or RLS changes; reads use the existing own-row policies.

Honesty rules enforced in code and covered by `tests/evidence.test.ts`:
- Labels on every figure: system-recorded, auto-graded, AI-generated practice, self-reported, human-reviewed.
- No XP, levels or rankings. Quiz credit uses the best attempt, pass mark 70.
- Only credentials with status `verified` are shown as verified; others are counted as "in review or not verified".
- Portfolio links must be https. Missing scores are ignored, never counted as 0.
- Copy summary and Print/Save as PDF (print stylesheet hides navigation). No public share link: a public page would need new database exposure and is not part of this release.
- Employers can check a code at `/?verify=CODE` (uses the existing public verification view; no evidence URL is exposed).

Limits: portfolio entries are self-reported; AI practice scores are not assessments; the live curriculum is still small (2 lessons per course).
