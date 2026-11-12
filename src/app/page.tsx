"use client";
import { useEffect, useMemo, useState } from "react";
import { screenPassword, screenMessage } from "../lib/password-security";
import { roadmapCourses, roadmapSteps, nextBestAction, remainingMinutes, weeksToFinish } from "../lib/roadmap";
import { supabase } from "../lib/supabase";

type A = any;
type Line = { role: "user" | "assistant"; content: string };
const TABS = ["Overview", "Learn", "Sales Lab", "Portfolio", "Credentials"];
const LEVELS: [string, number][] = [["Novice", 0], ["Apprentice", 50], ["Practitioner", 150], ["Specialist", 300]];
const SCEN: [string, string][] = [["hvac", "HVAC company owner"], ["freight", "Freight broker owner"], ["saas", "B2B SaaS marketing VP"], ["ecommerce", "E-commerce founder"]];

function level(xp: number) { let l = LEVELS[0]; for (const x of LEVELS) if (xp >= x[1]) l = x; const i = LEVELS.indexOf(l); const next = LEVELS[i + 1]; return { name: l[0], next: next ? next[1] - xp : 0 }; }
function Md({ text }: { text: string }) {
  const out: A[] = []; let list: string[] = [];
  const flush = (k: number) => { if (list.length) { out.push(<ul key={"u" + k}>{list.map((x, i) => <li key={i}>{x}</li>)}</ul>); list = []; } };
  (text || "").split(/\r?\n/).forEach((raw, i) => {
    const l = raw.trim();
    if (/^[-*]\s+/.test(l)) { list.push(l.replace(/^[-*]\s+/, "").replace(/\*\*/g, "")); return; }
    flush(i);
    if (!l) return;
    const h = l.match(/^(#{1,3})\s+(.*)$/);
    if (h) out.push(h[1].length === 1 ? <h2 key={i}>{h[2]}</h2> : <h3 key={i}>{h[2]}</h3>);
    else out.push(<p key={i}>{l.replace(/\*\*/g, "")}</p>);
  });
  flush(9999);
  return <div className="lesson">{out}</div>;
}

export default function Home() {
  const [tab, setTab] = useState("Overview");
  const [session, setSession] = useState<A>(null);
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<A>(null);
  const [courses, setCourses] = useState<A[]>([]);
  const [lessons, setLessons] = useState<A[]>([]);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [creds, setCreds] = useState<A[]>([]);
  const [projects, setProjects] = useState<A[]>([]);
  const [notice, setNotice] = useState("");
  const [loadErr, setLoadErr] = useState("");
  // auth
  const [mode, setMode] = useState("signin"); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [fullName, setFullName] = useState(""); const [busy, setBusy] = useState(false); const [authMsg, setAuthMsg] = useState("");
  // learn
  const [course, setCourse] = useState<A>(null); const [lesson, setLesson] = useState<A>(null); const [quiz, setQuiz] = useState<A[]>([]); const [ans, setAns] = useState<Record<string, number>>({}); const [qres, setQres] = useState<A>(null); const [lmsg, setLmsg] = useState("");
  // sales
  const [scen, setScen] = useState("hvac"); const [chat, setChat] = useState<Line[]>([]); const [draft, setDraft] = useState(""); const [thinking, setThinking] = useState(false); const [smsg, setSmsg] = useState(""); const [evalr, setEvalr] = useState<A>(null);
  // portfolio
  const [pt, setPt] = useState(""); const [pp, setPp] = useState(""); const [pa, setPa] = useState(""); const [pr, setPr] = useState(""); const [pu, setPu] = useState(""); const [pmsg, setPmsg] = useState("");
  // verify
  const [lp, setLp] = useState<A>(null); const [lpLoaded, setLpLoaded] = useState(false); const [lpErr, setLpErr] = useState(""); const [passed, setPassed] = useState<Record<string, boolean>>({}); const [ob, setOb] = useState<A>({ goal: "", experience: "", focus: "", weekly: 120 }); const [editPlan, setEditPlan] = useState(false);
  const [vc, setVc] = useState(""); const [vres, setVres] = useState<A>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    supabase.from("courses").select("*").order("sort_order").then(({ data, error }) => { if (error) setLoadErr("Could not load courses."); else setCourses(data || []); });
    supabase.from("lessons").select("*").order("sort_order").then(({ data }) => setLessons(data || []));
  }, []);
  const uid = session?.user?.id;
  async function loadMine() {
    if (!uid) { setProfile(null); setDone({}); setCreds([]); setProjects([]); setLp(null); setLpLoaded(false); setPassed({}); return; }
    const [p, lp, c, pj] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("lesson_progress").select("lesson_id").eq("user_id", uid),
      supabase.from("credentials").select("*").eq("user_id", uid).order("issued_at", { ascending: false }),
      supabase.from("portfolio_projects").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
    ]);
    if (p.error || lp.error) setLoadErr("Some of your data could not be loaded. Refresh to retry."); else setLoadErr("");
    setProfile(p.data); const d: Record<string, boolean> = {}; (lp.data || []).forEach((r: A) => (d[r.lesson_id] = true)); setDone(d);
    setCreds(c.data || []); setProjects(pj.data || []);
    const [lpr, qa] = await Promise.all([
      supabase.from("learner_profiles").select("*").eq("user_id", uid).maybeSingle(),
      supabase.from("quiz_attempts").select("lesson_id,score").eq("user_id", uid),
    ]);
    if (lpr.error) setLpErr(/PGRST205|42P01|schema cache/.test(lpr.error.code + " " + lpr.error.message) ? "The learning plan is not enabled on this site yet." : "Your learning plan could not be loaded."); else setLpErr("");
    setLp(lpr.data); setLpLoaded(true);
    const ps: Record<string, boolean> = {}; (qa.data || []).forEach((r: A) => { if (r.score >= 70) ps[r.lesson_id] = true; }); setPassed(ps);
  }
  async function savePlan() {
    if (!ob.goal || !ob.experience || !ob.focus) { setLpErr("Answer all three questions."); return; }
    const w = Math.min(2400, Math.max(15, Math.round(Number(ob.weekly) || 0)));
    const row = { user_id: uid, goal: ob.goal, experience: ob.experience, focus: ob.focus, weekly_minutes: w, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("learner_profiles").upsert(row, { onConflict: "user_id" });
    if (error) { setLpErr("Could not save your plan. " + (error.message || "")); return; }
    setLpErr(""); setEditPlan(false); await loadMine();
  }
  const plan = useMemo(() => {
    if (!lp) return null;
    const cs = roadmapCourses(courses as A, lp.focus, lp.experience);
    const steps = roadmapSteps(cs, lessons as A, done, passed);
    return { cs, steps, action: nextBestAction(steps, lp.focus), mins: remainingMinutes(steps) };
  }, [lp, courses, lessons, done, passed]);
  function goAction() {
    if (!plan) return; const a = plan.action;
    if (a.kind === "lesson" || a.kind === "quiz") { setTab("Learn"); setCourse(null); openLesson(a.step.lesson); }
    else if (a.kind === "salesLab") setTab("Sales Lab"); else setTab("Portfolio");
    window.scrollTo(0, 0);
  }
  useEffect(() => { loadMine(); }, [uid]);

  const xp = profile?.xp_total || 0; const lv = level(xp);
  const total = lessons.length; const doneN = lessons.filter((l) => done[l.id]).length; const pct = total ? Math.round((doneN / total) * 100) : 0;
  const byCourse = useMemo(() => { const m: Record<string, A[]> = {}; lessons.forEach((l) => (m[l.course_id] = m[l.course_id] || []).push(l)); return m; }, [lessons]);

  async function auth() {
    setBusy(true); setAuthMsg("");
    try {
      if (mode === "signup") {
        setAuthMsg("Checking your password against known breaches...");
        const screen = await screenPassword(password);
        if (screen.status !== "safe") { setAuthMsg(screenMessage(screen)); setBusy(false); return; }
        setAuthMsg("");
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
        if (error) setAuthMsg(error.message); else if (!data.session) setAuthMsg("Account created. Check your email to confirm it, then sign in."); else setAuthMsg("");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setAuthMsg(error.message);
      }
    } catch { setAuthMsg("Could not reach the server. Try again."); }
    setBusy(false);
  }
  async function openLesson(l: A) {
    setLesson(l); setQres(null); setAns({}); setLmsg(""); setQuiz([]);
    const { data, error } = await supabase.from("quiz_public_questions").select("*").eq("lesson_id", l.id).order("sort_order");
    if (error) setLmsg("Could not load the quiz."); else setQuiz(data || []);
  }
  async function completeLesson() {
    setLmsg("Saving...");
    const { data, error } = await supabase.rpc("complete_lesson", { p_lesson_id: lesson.id });
    if (error) { setLmsg("Could not save: " + error.message); return; }
    setLmsg(data > 0 ? "Lesson saved. +" + data + " XP (practice points)." : "Lesson already recorded."); await loadMine();
  }
  async function submitQuiz() {
    if (quiz.some((q) => ans[q.id] === undefined)) { setLmsg("Answer every question first."); return; }
    setLmsg("Submitting...");
    const { data, error } = await supabase.rpc("submit_quiz", { p_lesson_id: lesson.id, p_answers: quiz.map((q) => ({ question_id: q.id, selected_option: ans[q.id] })) });
    if (error) { setLmsg("Could not submit: " + error.message); return; }
    setQres(data); setLmsg(""); await loadMine();
  }
  async function token() { const { data } = await supabase.auth.getSession(); return data.session?.access_token || ""; }
  async function coach(body: A) {
    const r = await fetch("/api/coach", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + (await token()) }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Request failed."); return j;
  }
  async function send() {
    const v = draft.trim(); if (!v || thinking) return;
    const next: Line[] = [...chat, { role: "user", content: v }]; setChat(next); setDraft(""); setThinking(true); setSmsg("");
    try { const j = await coach({ mode: "roleplay", scenario: scen, messages: next }); setChat([...next, { role: "assistant", content: j.reply }]); }
    catch (e: any) { setChat(chat); setDraft(v); setSmsg(e.message); }
    setThinking(false);
  }
  async function endScore() {
    if (chat.filter((m) => m.role === "user").length < 2) { setSmsg("Say at least two things to the prospect first."); return; }
    setThinking(true); setSmsg("");
    try {
      const j = await coach({ mode: "evaluate", scenario: scen, messages: chat }); setEvalr(j.evaluation);
      const { error } = await supabase.from("roleplay_sessions").insert({ user_id: uid, scenario: scen, transcript: chat, evaluation: j.evaluation, score: j.evaluation.total, model: j.model });
      if (error) setSmsg("Scored, but the session could not be saved: " + error.message); else setSmsg("Session saved.");
    } catch (e: any) { setSmsg(e.message); }
    setThinking(false);
  }
  async function addProject() {
    if (!pt.trim() || !pp.trim() || !pa.trim() || !pr.trim()) { setPmsg("Fill in title, problem, action and result."); return; }
    if (/guarantee|#\s?1\b|first page/i.test(pr)) { setPmsg("The result mentions a guarantee or a ranking claim. Describe only what you measured, with a date."); return; }
    if (pu && !/^https:\/\//i.test(pu)) { setPmsg("The artifact link must start with https://"); return; }
    const { error } = await supabase.from("portfolio_projects").insert({ user_id: uid, title: pt.trim(), problem: pp.trim(), action: pa.trim(), result: pr.trim(), artifact_url: pu.trim() || null });
    if (error) { setPmsg("Could not save: " + error.message); return; }
    setPt(""); setPp(""); setPa(""); setPr(""); setPu(""); setPmsg("Saved."); loadMine();
  }
  async function delProject(id: string) { const { error } = await supabase.from("portfolio_projects").delete().eq("id", id).eq("user_id", uid); if (error) setPmsg("Could not delete."); else loadMine(); }
  async function verify() {
    setVres(null); const code = vc.trim(); if (!code) return;
    const { data, error } = await supabase.from("public_credential_verification").select("*").eq("verification_code", code).maybeSingle();
    setVres(error ? { err: "Could not check that code." } : data ? { ok: data } : { none: true });
  }

  if (!ready) return <div className="wrap"><p className="mut" style={{ paddingTop: 40 }}>Loading...</p></div>;
  return (
    <div className="wrap">
      <header className="top"><p className="brand">Corporate Curators &middot; AEO 9</p><h1>Be the answer. Prove the expertise.</h1><p className="mut">AI search, answer engine and generative engine optimization. Proof before pitch.</p></header>
      {loadErr && <div className="notice err" role="status">{loadErr}</div>}
      {tab === "Overview" && (<>
        {!session ? (
          <div className="card"><h2>Student portal</h2>
            <div className="row"><button className={mode === "signin" ? "" : "ghost"} onClick={() => setMode("signin")}>Sign in</button><button className={mode === "signup" ? "" : "ghost"} onClick={() => setMode("signup")}>Create account</button></div>
            {mode === "signup" && <><label htmlFor="fn">Full name</label><input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" /></>}
            <label htmlFor="em">Email</label><input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <label htmlFor="pw">Password</label><input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
            <button disabled={busy || !email || password.length < 8} onClick={auth}>{busy ? "Working..." : mode === "signup" ? "Create account" : "Sign in"}</button>
            {authMsg && <p className="notice" role="status">{authMsg}</p>}
            <p className="mut">Use at least 8 characters. Your progress is saved to your account.</p>
          </div>
        ) : (
          <div className="card"><h2>Command center</h2><p className="mut">{profile?.full_name || session.user.email}</p>
            <div className="stat"><div><b>{lv.name}</b>level</div><div><b>{xp}</b>practice XP</div><div><b>{doneN} / {total}</b>lessons</div><div><b>{projects.length}</b>portfolio items</div></div>
            <div className="bar"><i style={{ width: pct + "%" }} /></div><p className="mut">{pct}% of published lessons complete. {lv.next ? lv.next + " XP to the next level." : ""}</p>
            <p className="mut">XP measures practice and engagement. It is not proof of professional competence.</p>
            <button className="ghost" onClick={() => supabase.auth.signOut()}>Sign out</button></div>
        )}
        {session && lpLoaded && (!lp || editPlan) && (
          <div className="card"><h2>{lp ? "Update your plan" : "Set up your learning plan"}</h2>
            <p className="mut">Three quick questions. They only shape the order of lessons and your next step. You can change them any time.</p>
            <label htmlFor="ob-goal">What is your goal?</label>
            <select id="ob-goal" value={ob.goal} onChange={(e) => setOb({ ...ob, goal: e.target.value })}><option value="">Choose one</option><option value="job">Get a job or promotion</option><option value="upskill">Upskill in my current role</option><option value="agency">Serve clients or run an agency</option><option value="sell">Sell better with AI search proof</option><option value="explore">Just exploring</option></select>
            <label htmlFor="ob-exp">Your experience with SEO or AI search</label>
            <select id="ob-exp" value={ob.experience} onChange={(e) => setOb({ ...ob, experience: e.target.value })}><option value="">Choose one</option><option value="new">New to it</option><option value="some">Some experience</option><option value="experienced">Experienced</option></select>
            <label htmlFor="ob-focus">Where do you want to focus?</label>
            <select id="ob-focus" value={ob.focus} onChange={(e) => setOb({ ...ob, focus: e.target.value })}><option value="">Choose one</option><option value="seo_aeo">AI search, AEO and GEO</option><option value="amazon">Amazon search</option><option value="python_ml">Python and machine learning</option><option value="sales">Selling with AI search</option><option value="all">Everything</option></select>
            <label htmlFor="ob-min">Minutes you can study per week</label>
            <input id="ob-min" type="number" min={15} max={2400} value={ob.weekly} onChange={(e) => setOb({ ...ob, weekly: e.target.value })} />
            <button onClick={savePlan}>Save my plan</button>{lp && <button className="ghost" onClick={() => setEditPlan(false)}>Cancel</button>}
          </div>
        )}
        {session && lp && plan && !editPlan && (
          <div className="card"><h2>Your next step</h2>
            <p><b>{plan.action.text}</b></p>
            <button onClick={goAction}>{plan.action.kind === "lesson" ? "Open lesson" : plan.action.kind === "quiz" ? "Open quiz" : plan.action.kind === "salesLab" ? "Open Sales Lab" : "Open portfolio"}</button>
            <h3 style={{ marginTop: 16 }}>Your roadmap</h3>
            {plan.steps.length === 0 ? <p className="mut">No lessons are published for this focus yet. The Sales Lab and portfolio are open to you.</p> : <>
              <p className="mut">{plan.steps.filter((s) => s.done).length} of {plan.steps.length} lessons done &middot; about {plan.mins} minutes of lesson reading left (about {weeksToFinish(plan.mins, lp.weekly_minutes)} week{weeksToFinish(plan.mins, lp.weekly_minutes) === 1 ? "" : "s"} at {lp.weekly_minutes} min/week). Estimate excludes practice and quizzes.</p>
              {plan.cs.map((c) => { const ss = plan.steps.filter((s) => s.course.id === c.id); if (!ss.length) return null; return <div key={c.id} style={{ margin: "8px 0" }}><b>{c.title}</b> <span className="mut">{c.level}</span>{ss.map((s) => <div key={s.lesson.id} className="mut">{s.done ? (s.passed ? "✓ " : "◐ ") : "○ "}{s.lesson.title}{s.done && !s.passed ? " (quiz not passed yet)" : ""}</div>)}</div>; })}
            </>}
            <button className="ghost" onClick={() => { setOb({ goal: lp.goal, experience: lp.experience, focus: lp.focus, weekly: lp.weekly_minutes }); setEditPlan(true); }}>Change my plan</button>
          </div>
        )}
        {session && lpErr && <div className="notice err" role="status">{lpErr}</div>}
        <div className="card"><h3>Learning tracks</h3>{courses.length === 0 ? <p className="mut">No published courses yet.</p> : courses.map((c) => { const ls = byCourse[c.id] || []; const d = ls.filter((l) => done[l.id]).length; return <div key={c.id} style={{ margin: "10px 0" }}><b>{c.title}</b> <span className="mut">{c.level} &middot; {ls.length} lessons{session ? " &middot; " + d + " done" : ""}</span><p className="mut">{c.description}</p></div>; })}</div>
      </>)}

      {tab === "Learn" && (!session ? <div className="card"><p>Sign in on the Overview tab to learn and save progress.</p></div> : lesson ? (
        <div className="card"><button className="ghost" onClick={() => setLesson(null)}>&larr; Back</button><h2 style={{ marginTop: 12 }}>{lesson.title}</h2><p className="mut">{lesson.duration_minutes} min</p><Md text={lesson.content_md} />
          <button onClick={completeLesson}>{done[lesson.id] ? "Completed (tap to re-check)" : "Mark lesson complete"}</button>
          {quiz.length > 0 && <div style={{ marginTop: 16 }}><h3>Knowledge check</h3>{quiz.map((q, qi) => (<div key={q.id} className="card"><p><b>{qi + 1}. {q.prompt}</b></p>{(q.options || []).map((o: string, oi: number) => <label key={oi} className="opt"><input type="radio" name={q.id} checked={ans[q.id] === oi} onChange={() => setAns({ ...ans, [q.id]: oi })} /><span>{String(o)}</span></label>)}</div>))}
            <button onClick={submitQuiz}>Submit answers</button></div>}
          {qres && <div className="notice" role="status">Score: {qres.score}%{qres.correct_count !== undefined ? " (" + qres.correct_count + " of " + (qres.total_questions ?? quiz.length) + " correct)" : ""}. {qres.score >= 70 ? "Passed." : "Below the 70% pass mark. Review the lesson and try again."}</div>}
          {lmsg && <p className="notice" role="status">{lmsg}</p>}</div>
      ) : course ? (
        <div className="card"><button className="ghost" onClick={() => setCourse(null)}>&larr; All courses</button><h2 style={{ marginTop: 12 }}>{course.title}</h2><p className="mut">{course.description}</p>{(byCourse[course.id] || []).map((l) => <button key={l.id} className="item ghost" onClick={() => openLesson(l)}>{done[l.id] ? "✓ " : ""}{l.title}<br /><span className="mut">{l.summary}</span></button>)}</div>
      ) : (<div>{courses.map((c) => <button key={c.id} className="item" onClick={() => setCourse(c)}><b>{c.title}</b><br /><span className="mut">{c.level} &middot; {(byCourse[c.id] || []).length} lessons</span></button>)}{courses.length === 0 && <div className="card"><p className="mut">No published courses yet.</p></div>}</div>))}

      {tab === "Sales Lab" && (!session ? <div className="card"><p>Sign in on the Overview tab to use the Sales Lab.</p></div> : (
        <div className="card"><h2>Sales Lab</h2><p className="mut">A training simulation. The prospect is played by an AI model. Nothing here is a real sale or a verified result.</p>
          <label htmlFor="sc">Prospect</label><select id="sc" value={scen} onChange={(e) => { setScen(e.target.value); setChat([]); setEvalr(null); }}>{SCEN.map((s) => <option key={s[0]} value={s[0]}>{s[1]}</option>)}</select>
          <div className="chat">{chat.length === 0 && <p className="mut">Open the conversation with a short, relevant question.</p>}{chat.map((m, i) => <div key={i} className={"bub " + (m.role === "user" ? "you" : "ai")}>{m.content}</div>)}{thinking && <p className="mut">Thinking...</p>}</div>
          <textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="What would you say to the client?" />
          <div className="row"><button disabled={thinking || !draft.trim()} onClick={send}>Send</button><button className="ghost" disabled={thinking} onClick={endScore}>End and score</button></div>
          {smsg && <p className="notice" role="status">{smsg}</p>}
          {evalr && <div className="card"><h3>AI coach score: {evalr.total} / 100</h3><p className="mut">AI-generated coaching. Not a human review and not a credential.</p>{["Discovery", "Communication", "Technical accuracy", "Objection handling", "Value", "Closing"].map((n, i) => <div key={n}>{n}: <b>{evalr.scores[i]}</b><div className="bar"><i style={{ width: evalr.scores[i] + "%" }} /></div></div>)}<h3>Strengths</h3><ul>{evalr.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul><h3>Fix next</h3><ul>{evalr.fixes.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>}
        </div>))}

      {tab === "Portfolio" && (!session ? <div className="card"><p>Sign in on the Overview tab to build your portfolio.</p></div> : (<>
        <div className="card"><h2>Add a project</h2><p className="mut">Describe real or practice work. Say which it is. Do not claim results you did not measure.</p>
          <label htmlFor="pt">Title</label><input id="pt" value={pt} onChange={(e) => setPt(e.target.value)} maxLength={120} />
          <label htmlFor="pp">Problem</label><textarea id="pp" rows={2} value={pp} onChange={(e) => setPp(e.target.value)} maxLength={1000} />
          <label htmlFor="pa">What you did</label><textarea id="pa" rows={3} value={pa} onChange={(e) => setPa(e.target.value)} maxLength={2000} />
          <label htmlFor="pr">Measured result, with date and method</label><textarea id="pr" rows={2} value={pr} onChange={(e) => setPr(e.target.value)} maxLength={1000} />
          <label htmlFor="pu">Link to evidence (https, optional)</label><input id="pu" value={pu} onChange={(e) => setPu(e.target.value)} maxLength={300} />
          <button onClick={addProject}>Save project</button>{pmsg && <p className="notice" role="status">{pmsg}</p>}</div>
        {projects.map((p) => <div key={p.id} className="card"><h3>{p.title}</h3><p><b>Problem:</b> {p.problem}</p><p><b>Action:</b> {p.action}</p><p><b>Result:</b> {p.result}</p>{p.artifact_url && /^https:\/\//i.test(p.artifact_url) && <p><a style={{ color: "var(--gold)" }} href={p.artifact_url} target="_blank" rel="noopener noreferrer">Evidence link</a></p>}<p className="mut">Self-reported. Not independently verified.</p><button className="ghost" onClick={() => delProject(p.id)}>Delete</button></div>)}
        {projects.length === 0 && <p className="mut">No projects yet.</p>}</>))}

      {tab === "Credentials" && (<>
        <div className="card"><h2>Verify a credential</h2><p className="mut">Enter a verification code to check its status.</p><label htmlFor="vc">Verification code</label><input id="vc" value={vc} onChange={(e) => setVc(e.target.value)} /><button onClick={verify}>Check</button>
          {vres?.ok && <div className="notice"><b>{vres.ok.title}</b> &middot; {vres.ok.issuer}<br />Status: {vres.ok.status}. Issued {new Date(vres.ok.issued_at).toLocaleDateString()}.</div>}{vres?.none && <p className="notice err">No credential matches that code.</p>}{vres?.err && <p className="notice err">{vres.err}</p>}</div>
        {session && <div className="card"><h2>Your credentials</h2>{creds.length === 0 ? <p className="mut">None yet. Credentials are issued after an instructor reviews your practical work. Lesson completion and XP alone do not earn one.</p> : creds.map((c) => <div key={c.id} className="notice"><b>{c.title}</b> &middot; {c.issuer}<br />Status: {c.status}. Verification code: {c.verification_code}</div>)}</div>}
      </>)}

      <footer>&copy; 2026 Corporate Curators &middot; AEO 9 is a training program, not a licensing body. We do not guarantee employment.</footer>
      <nav className="tabs" aria-label="Sections">{TABS.map((t) => <button key={t} className={tab === t ? "on" : ""} onClick={() => { setTab(t); window.scrollTo(0, 0); }}>{t}</button>)}</nav>
    </div>
  );
}
