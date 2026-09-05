import { describe,expect,it } from "vitest";
import { questionTemplateCsv,validateQuestionCsv } from "./academic-import";

describe("question CSV import",()=>{
  it("accepts the downloadable template row",()=>{
    const rows=validateQuestionCsv(questionTemplateCsv());
    expect(rows).toHaveLength(1);
    expect(rows[0].valid).toBe(true);
    expect(rows[0].value?.correctAnswers).toEqual(["ALT"]);
  });
  it("reports malformed rows without silently importing them",()=>{
    const [row]=validateQuestionCsv("exam,subject,question_type,question,correct_answer\n,Pathology,unknown,,Z");
    expect(row.valid).toBe(false);
    expect(row.errors).toEqual(expect.arrayContaining(["exam is required","question is required","unsupported question_type"]));
  });
  it("supports variable option counts and multiple correct answers",()=>{
    const [row]=validateQuestionCsv("exam,subject,question_type,question,option_a,option_b,option_c,correct_answer\nCRE,Microbiology,multiple_mcq,Select organisms,A,B,C,A|C");
    expect(row.valid).toBe(true);
    expect(row.value?.options).toHaveLength(3);
    expect(row.value?.correctAnswers).toEqual(["A","C"]);
  });
});
