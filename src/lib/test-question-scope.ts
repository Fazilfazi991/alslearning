import type { CoreData, Test } from "./core-repository";

export function hasTestScope(data: CoreData, test: Test) {
  return !!test.exam_id && !!test.program_id &&
    data.subjects.some((subject) => subject.id === test.subject_id) &&
    data.mappings.some((mapping) => mapping.program_id === test.program_id && mapping.subject_id === test.subject_id) &&
    (!test.chapter_id || data.chapters.some((section) => section.id === test.chapter_id && section.subject_id === test.subject_id)) &&
    (!test.topic_id || data.topics.some((topic) => topic.id === test.topic_id && topic.subject_id === test.subject_id && (!test.chapter_id || topic.chapter_id === test.chapter_id)));
}

export function eligibleTestQuestions(data: CoreData, test: Test) {
  if (!hasTestScope(data, test)) return [];
  return data.questions.filter((question) =>
    question.status === "active" && question.type !== "match_following" &&
    question.exam_id === test.exam_id &&
    (!question.program_id || question.program_id === test.program_id) &&
    question.subject_id === test.subject_id &&
    (!test.chapter_id || question.chapter_id === test.chapter_id) &&
    (!test.topic_id || question.topic_id === test.topic_id) &&
    (test.selection_mode !== "generated" || !test.selection_rules?.difficulty || question.difficulty === test.selection_rules.difficulty),
  );
}

export function testSelectionError(data: CoreData, test: Test): string | null {
  if (!hasTestScope(data, test)) return "Choose a subject and a valid section within the program first.";
  const eligible = eligibleTestQuestions(data, test);
  if (test.selection_mode === "generated") {
    return Number.isInteger(test.question_count) && test.question_count > 0 && test.question_count <= eligible.length
      ? null : `Choose between 1 and ${eligible.length} available active questions.`;
  }
  return test.question_ids.length > 0 && new Set(test.question_ids).size === test.question_ids.length &&
    test.question_ids.every((id) => eligible.some((question) => question.id === id))
    ? null : "Select active questions from this scope; remove any unavailable selections.";
}
