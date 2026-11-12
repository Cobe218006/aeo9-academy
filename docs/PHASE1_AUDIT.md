# AEO 9 Academy — Phase 1 audit (read-only), 2026-11-11

Status labels: NOT STARTED / IN PROGRESS / IMPLEMENTED / TESTED / DEPLOYED / VERIFIED. Nothing here is VERIFIED.

## Vercel
- Project `aeo9-academy` (prj_kzXgMot0qJia8eBZ2KDrLSZrcRqn), team `jc-majors`, Next.js. Domains: aeo9-academy.vercel.app, aeo9-academy-jc-majors.vercel.app.
- Two production deployments, both READY, uploaded directly (no Git metadata). Status: DEPLOYED (not tested).
- Deployed source: `src/app/page.tsx` (client component), `src/app/layout.tsx`, `src/app/globals.css`, `src/app/api/coach/route.ts`, `src/lib/supabase.ts`, `package.json`, `tsconfig.json`, `.env.example`.
- SSO protection applies to preview deployments only.
- Whether `OPENAI_API_KEY` is set is unknown. The coach route returns 503 "not connected" when it is missing.

## Supabase (qyjkvuemzojoxwiaorgi, Postgres 17)
- 26 public tables, all with RLS enabled. Rows: courses 8, lessons 14, quiz_questions 8; all others 0.
- Recorded migrations: 20261110223119 aeo9_academy_core_schema_and_curriculum; 20261110223136 aeo9_secure_quiz_and_progress_functions; 20261110223708 aeo9_restrict_client_quiz_attempt_writes.
- GAP: the 16-table additive migration is not in the migration history. Write it down as a migration file before building on it.
- Advisors (security): `usage_limits` has RLS but no policy; `quiz_public_questions` and `public_credential_verification` are SECURITY DEFINER views (ERROR-level lint; review whether intentional); `complete_lesson` and `submit_quiz` are SECURITY DEFINER functions executable by `authenticated` (probably intentional; needs tests).

## Source recovery gap
The Vercel file API truncates large files. `src/app/page.tsx` (about 19 KB omitted) and `src/app/api/coach/route.ts` (about 2.4 KB omitted) could not be read in full, and `src/app/globals.css` was not retrieved. They are NOT in this branch. Do not connect this repository to the Vercel project until the full originals are committed, or the production build will fail.

## Known coach route behavior (partial read)
Requires a Bearer token validated through Supabase auth; accepts the last 14 messages of up to 3,000 characters; reads OPENAI_API_KEY and OPENAI_MODEL. No usage metering or rate limiting seen in the portion read.

## Next
1. Commit the full original page.tsx, coach route and globals.css (needs the original files from the owner).
2. Export the 16-table migration as a SQL file.
3. Connect the repository to the existing Vercel project.
4. Auth, roles, usage limits, then the rest in the order of the master prompt.
