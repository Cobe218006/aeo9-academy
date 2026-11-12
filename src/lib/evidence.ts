/**
 * Builds a hiring-manager evidence summary from a learner's OWN data.
 * Rules: no XP, no rankings, no invented numbers. Every item is labeled by how it was produced:
 *  - "system-recorded": completed/passed by the platform (lesson completion, auto-graded quiz).
 *  - "AI-generated": Sales Lab scores from an AI coach (practice, not an assessment).
 *  - "self-reported": portfolio entries written by the learner.
 *  - "verified": only credentials with status "verified" (issued after human review).
 */
type Row = Record<string, any>;

export type Evidence = {
  name: string;
  generated: string;
  lessons: { done: number; total: number };
  quizzes: { passed: number; attempted: number; avgBest: number | null };
  courses: { title: string; level: string; lessonsDone: number; lessonsTotal: number; quizzesPassed: number }[];
  sales: { sessions: number; avg: number | null; best: number | null; latest: string | null };
  portfolio: { title: string; problem: string; action: string; result: string; link: string }[];
  verified: { title: string; issuer: string; issued: string; code: string }[];
  pending: number;
};

const PASS = 70;
const avg = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);
const safeUrl = (u: unknown) => { try { const x = new URL(String(u)); return x.protocol === "https:" ? x.toString() : ""; } catch { return ""; } };

export function buildEvidence(d: { name: string; courses: Row[]; lessons: Row[]; done: Record<string, boolean>; attempts: Row[]; sessions: Row[]; projects: Row[]; creds: Row[]; now?: Date }): Evidence {
  const best: Record<string, number> = {};
  for (const a of d.attempts) { const s = a.score === null || a.score === undefined ? NaN : Number(a.score); if (Number.isFinite(s)) best[a.lesson_id] = Math.max(best[a.lesson_id] ?? 0, s); }
  const passedIds = Object.keys(best).filter((k) => best[k] >= PASS);
  const num = (v: unknown) => (v === null || v === undefined || v === "" ? NaN : Number(v));
  const scores = d.sessions.map((s) => num(s.score)).filter((n) => Number.isFinite(n));
  const dated = d.sessions.map((s) => s.created_at).filter(Boolean).sort();
  return {
    name: d.name || "Learner",
    generated: (d.now ?? new Date()).toISOString().slice(0, 10),
    lessons: { done: d.lessons.filter((l) => d.done[l.id]).length, total: d.lessons.length },
    quizzes: { passed: passedIds.length, attempted: Object.keys(best).length, avgBest: avg(Object.values(best)) },
    courses: d.courses.map((c) => {
      const ls = d.lessons.filter((l) => l.course_id === c.id);
      return { title: c.title, level: c.level, lessonsTotal: ls.length, lessonsDone: ls.filter((l) => d.done[l.id]).length, quizzesPassed: ls.filter((l) => (best[l.id] ?? 0) >= PASS).length };
    }).filter((c) => c.lessonsTotal > 0 && (c.lessonsDone > 0 || c.quizzesPassed > 0)),
    sales: { sessions: scores.length, avg: avg(scores), best: scores.length ? Math.max(...scores) : null, latest: dated.length ? String(dated[dated.length - 1]).slice(0, 10) : null },
    portfolio: d.projects.map((p) => ({ title: String(p.title || ""), problem: String(p.problem || ""), action: String(p.action || ""), result: String(p.result || ""), link: safeUrl(p.artifact_url) })),
    verified: d.creds.filter((c) => c.status === "verified").map((c) => ({ title: c.title, issuer: c.issuer, issued: String(c.issued_at || "").slice(0, 10), code: c.verification_code })),
    pending: d.creds.filter((c) => c.status !== "verified").length,
  };
}

export function evidenceText(e: Evidence): string {
  const L: string[] = [];
  L.push(`AEO 9 Academy evidence summary: ${e.name} (generated ${e.generated})`);
  L.push("Labels: system-recorded = completed or auto-graded on the platform; AI-generated = practice scoring by an AI coach, not an assessment; self-reported = written by the learner; verified = credential issued after human review.");
  L.push(`Lessons completed (system-recorded): ${e.lessons.done} of ${e.lessons.total}`);
  L.push(`Knowledge checks passed at 70% or higher (auto-graded): ${e.quizzes.passed} of ${e.quizzes.attempted} attempted${e.quizzes.avgBest !== null ? `; average best score ${e.quizzes.avgBest}%` : ""}`);
  e.courses.forEach((c) => L.push(`- ${c.title} (${c.level}): ${c.lessonsDone}/${c.lessonsTotal} lessons, ${c.quizzesPassed} quizzes passed`));
  L.push(e.sales.sessions ? `Sales Lab practice (AI-generated): ${e.sales.sessions} sessions; average ${e.sales.avg}/100, best ${e.sales.best}/100; latest ${e.sales.latest}` : "Sales Lab practice: none recorded");
  L.push(e.portfolio.length ? "Portfolio (self-reported):" : "Portfolio: none recorded");
  e.portfolio.forEach((p) => L.push(`- ${p.title}\n  Problem: ${p.problem}\n  Action: ${p.action}\n  Result: ${p.result}${p.link ? `\n  Link: ${p.link}` : ""}`));
  L.push(e.verified.length ? "Verified credentials:" : "Verified credentials: none yet");
  e.verified.forEach((c) => L.push(`- ${c.title}, ${c.issuer}, issued ${c.issued}, code ${c.code}`));
  L.push("This summary is generated from the learner's own account data. It is not an employment guarantee or a licence.");
  return L.join("\n");
}
