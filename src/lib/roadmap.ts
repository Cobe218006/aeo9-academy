export type Focus = "seo_aeo" | "amazon" | "python_ml" | "sales" | "all";
export type Experience = "new" | "some" | "experienced";
export type Course = { id: string; slug: string; title: string; level: string; sort_order: number };
export type Lesson = { id: string; course_id: string; title: string; duration_minutes: number | null; sort_order: number };

const FOCUS_SLUGS: Record<Exclude<Focus, "all">, string[]> = {
  seo_aeo: ["ai-search-foundations", "master-aeo-geo-engineering", "master-share-of-model-analytics"],
  amazon: ["amazon-search-optimization", "master-amazon-search-intelligence"],
  python_ml: ["python-for-ai", "math-for-ml", "machine-learning-core", "llms-and-generative-ai", "mlops-and-evaluation", "master-python-search-intelligence", "master-applied-machine-learning", "master-llm-rag-engineering", "master-mlops-responsible-ai"],
  sales: ["ai-search-foundations", "sales-intelligence-lab"],
};

/** Courses for the learner's focus, in order. Experienced learners see Master courses first. */
export function roadmapCourses(courses: Course[], focus: Focus, experience: Experience): Course[] {
  const inFocus = focus === "all" ? courses : courses.filter((c) => FOCUS_SLUGS[focus].includes(c.slug));
  const isMaster = (c: Course) => c.level === "Master";
  return [...inFocus].sort((a, b) => {
    if (experience === "experienced" && isMaster(a) !== isMaster(b)) return isMaster(a) ? -1 : 1;
    return a.sort_order - b.sort_order;
  });
}

export type Step = { lesson: Lesson; course: Course; done: boolean; passed: boolean };

export function roadmapSteps(courses: Course[], lessons: Lesson[], done: Record<string, boolean>, passed: Record<string, boolean>): Step[] {
  const steps: Step[] = [];
  for (const c of courses) {
    lessons.filter((l) => l.course_id === c.id).sort((a, b) => a.sort_order - b.sort_order)
      .forEach((l) => steps.push({ lesson: l, course: c, done: !!done[l.id], passed: !!passed[l.id] }));
  }
  return steps;
}

export type Action =
  | { kind: "lesson"; step: Step; text: string }
  | { kind: "quiz"; step: Step; text: string }
  | { kind: "salesLab"; text: string }
  | { kind: "complete"; text: string };

/** Next Best Action: first lesson not finished; a finished lesson without a passed quiz comes before moving on. */
export function nextBestAction(steps: Step[], focus: Focus): Action {
  const s = steps.find((x) => !x.done || !x.passed);
  if (s) return !s.done
    ? { kind: "lesson", step: s, text: "Start “" + s.lesson.title + "” (" + s.course.title + ")" }
    : { kind: "quiz", step: s, text: "Pass the knowledge check for “" + s.lesson.title + "”" };
  if (focus === "sales" || focus === "all") return { kind: "salesLab", text: "Practice a Sales Lab conversation and save the transcript" };
  return { kind: "complete", text: "Your roadmap is complete. Add a portfolio item that shows what you built." };
}

export function remainingMinutes(steps: Step[]): number {
  return steps.filter((s) => !s.done).reduce((n, s) => n + (s.lesson.duration_minutes || 10), 0);
}

/** Honest estimate: reading time only, excludes practice and quizzes. */
export function weeksToFinish(minutesLeft: number, weeklyMinutes: number): number {
  if (minutesLeft <= 0) return 0;
  return Math.max(1, Math.ceil(minutesLeft / Math.max(15, weeklyMinutes)));
}
