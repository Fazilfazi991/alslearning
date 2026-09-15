import { canManage, type CoreData } from "./core-repository";

type QuestionScope = { exam_id?: string | null; program_id?: string | null; subject_id?: string | null };

export function teacherQuestionAction(data: CoreData, question: QuestionScope) {
  return canManage(data, "questions", question as Parameters<typeof canManage>[2])
    ? "Edit question" : "View question";
}
