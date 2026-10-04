import { describe, expect, it } from "vitest";
import { programLearning, summarizeLearning, type LearningItem } from "./learning-progress";
const items: LearningItem[] = [
  { id: "content:1", title: "Note", program_id: "one", href: "/student/learn/note", position: 0, completed: false },
  { id: "recording:1", title: "Recorded class", program_id: "one", href: "/student/recorded-classes/1", position: 120, completed: true },
  { id: "recording:2", title: "Other program", program_id: "two", href: "/student/recorded-classes/2", position: 30, completed: false },
];
describe("learning progress", () => {
  it("includes published recordings and resources in the same program denominator", () => {
    expect(programLearning(items, "one")).toEqual({ total: 2, completed: 1, seconds: 120, percentage: 50 });
  });
  it("keeps other programs separate and handles empty access", () => {
    expect(programLearning(items, "none")).toEqual({ total: 0, completed: 0, seconds: 0, percentage: 0 });
    expect(summarizeLearning(items)).toEqual({ total: 3, completed: 1, seconds: 150 });
  });
});
