import { expect, it } from "vitest";
import { teacherQuestionAction } from "./teacher-question-action";
import type { CoreData } from "./core-repository";

const teacher = {role:"teacher",assignments:[{exam_id:null,program_id:"assigned-program",subject_id:"pathology",can_manage_questions:true,can_manage_content:true,can_manage_tests:true}]} as CoreData;

it("keeps canonical assigned-Subject questions read-only while permitting scoped authoring", () => {
  expect(teacherQuestionAction(teacher,{program_id:null,subject_id:"pathology"})).toBe("View question");
  expect(teacherQuestionAction(teacher,{program_id:"assigned-program",subject_id:"pathology"})).toBe("Edit question");
  expect(teacherQuestionAction(teacher,{program_id:"other-program",subject_id:"pathology"})).toBe("View question");
  expect(teacherQuestionAction(teacher,{program_id:"assigned-program",subject_id:"other-subject"})).toBe("View question");
  expect(teacherQuestionAction({...teacher,role:"admin",assignments:[]},{program_id:null,subject_id:"pathology"})).toBe("Edit question");
});
