import assert from "node:assert/strict";
import { buildEvidence, evidenceText } from "../src/lib/evidence.ts";
const courses = [{ id: "c1", title: "AI Search Foundations", level: "Beginner" }, { id: "c2", title: "Unstarted", level: "Beginner" }];
const lessons = [{ id: "l1", course_id: "c1" }, { id: "l2", course_id: "c1" }, { id: "l3", course_id: "c2" }];
const base = { name: "Pat", courses, lessons, done: { l1: true } as Record<string, boolean>, now: new Date("2026-11-12T00:00:00Z") };
// best-score logic: retry counts once, best wins, 70 passes, 69 does not
let e = buildEvidence({ ...base, attempts: [{ lesson_id: "l1", score: 50 }, { lesson_id: "l1", score: 80 }, { lesson_id: "l2", score: 69 }], sessions: [], projects: [], creds: [] });
assert.deepEqual(e.quizzes, { passed: 1, attempted: 2, avgBest: 75 });
assert.deepEqual(e.lessons, { done: 1, total: 3 });
assert.equal(e.courses.length, 1); assert.equal(e.courses[0].quizzesPassed, 1); // unstarted course hidden
// sales: only numeric scores; none -> nulls
assert.deepEqual(e.sales, { sessions: 0, avg: null, best: null, latest: null });
e = buildEvidence({ ...base, attempts: [], sessions: [{ score: 60, created_at: "2026-11-01T10:00:00Z" }, { score: 90, created_at: "2026-11-10T10:00:00Z" }, { score: null }], projects: [], creds: [] });
assert.deepEqual(e.sales, { sessions: 2, avg: 75, best: 90, latest: "2026-11-10" });
// credentials: only status=verified count as verified
e = buildEvidence({ ...base, attempts: [], sessions: [], projects: [], creds: [{ status: "verified", title: "T", issuer: "CC", issued_at: "2026-11-02T00:00:00Z", verification_code: "ABC" }, { status: "pending", title: "P" }, { status: "revoked", title: "R" }] });
assert.equal(e.verified.length, 1); assert.equal(e.pending, 2);
// portfolio links: https only; javascript:/http dropped
e = buildEvidence({ ...base, attempts: [], sessions: [], creds: [], projects: [{ title: "A", problem: "p", action: "a", result: "r", artifact_url: "https://x.com/y" }, { title: "B", artifact_url: "javascript:alert(1)" }, { title: "C", artifact_url: "http://x.com" }] });
assert.deepEqual(e.portfolio.map((p) => p.link), ["https://x.com/y", "", ""]);
// text output: labels present, no XP, no guarantee language, empty states honest
const t = evidenceText(buildEvidence({ ...base, attempts: [], sessions: [], projects: [], creds: [] }));
assert.ok(/self-reported/.test(t) && /AI-generated/.test(t) && /verified = credential issued after human review/.test(t));
assert.ok(!/\bxp\b/i.test(t)); assert.ok(/Verified credentials: none yet/.test(t)); assert.ok(/Portfolio: none recorded/.test(t));
assert.ok(/not an employment guarantee/.test(t));
console.log("evidence tests passed");
