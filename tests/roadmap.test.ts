import { roadmapCourses, roadmapSteps, nextBestAction, remainingMinutes, weeksToFinish } from "../src/lib/roadmap.ts";
import assert from "node:assert/strict";
const C = (id: string, slug: string, level: string, o: number) => ({ id, slug, title: slug, level, sort_order: o });
const courses = [C("a", "ai-search-foundations", "Beginner", 1), C("b", "python-for-ai", "Beginner", 3), C("m", "master-aeo-geo-engineering", "Master", 101), C("s", "sales-intelligence-lab", "Applied", 8)];
const L = (id: string, c: string, o: number, d = 10) => ({ id, course_id: c, title: id, duration_minutes: d, sort_order: o });
const lessons = [L("a1", "a", 1), L("a2", "a", 2, 20), L("m1", "m", 1, 30), L("b1", "b", 1)];
// focus filter + order
assert.deepEqual(roadmapCourses(courses, "seo_aeo", "new").map((c) => c.id), ["a", "m"]);
assert.deepEqual(roadmapCourses(courses, "seo_aeo", "experienced").map((c) => c.id), ["m", "a"]);
assert.deepEqual(roadmapCourses(courses, "python_ml", "some").map((c) => c.id), ["b"]);
// next best action
let steps = roadmapSteps(roadmapCourses(courses, "seo_aeo", "new"), lessons, {}, {});
assert.equal(nextBestAction(steps, "seo_aeo").kind, "lesson");
steps = roadmapSteps(roadmapCourses(courses, "seo_aeo", "new"), lessons, { a1: true }, {});
let a = nextBestAction(steps, "seo_aeo"); assert.equal(a.kind, "quiz"); // done but quiz not passed comes first
steps = roadmapSteps(roadmapCourses(courses, "seo_aeo", "new"), lessons, { a1: true, a2: true, m1: true }, { a1: true, a2: true, m1: true });
assert.equal(nextBestAction(steps, "seo_aeo").kind, "complete");
assert.equal(nextBestAction(steps, "all").kind, "salesLab");
// minutes + weeks
steps = roadmapSteps(roadmapCourses(courses, "seo_aeo", "new"), lessons, { a1: true }, {});
assert.equal(remainingMinutes(steps), 50);
assert.equal(weeksToFinish(50, 120), 1); assert.equal(weeksToFinish(250, 120), 3); assert.equal(weeksToFinish(0, 120), 0);
assert.equal(weeksToFinish(30, 0), 2); // weekly floor of 15 min
console.log("roadmap tests passed");
