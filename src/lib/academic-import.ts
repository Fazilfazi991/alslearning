import Papa from "papaparse";
import type { AcademicQuestion, QuestionSource, QuestionType } from "@/types/academic";
import { QUESTION_IMPORT_COLUMNS } from "./academic-seed";

export interface ImportRow { row: number; valid: boolean; errors: string[]; value?: AcademicQuestion }
const types: Record<string, QuestionType> = { single_mcq:"Single-answer MCQ", multiple_mcq:"Multiple-answer MCQ", true_false:"True / False", image_mcq:"Image-based MCQ", case_based:"Case-based", match_following:"Match-the-following" };
const sources: Record<string, QuestionSource> = { standard:"Standard", previous_exam:"Previous exam", recalled:"Recalled" };

export function questionTemplateCsv() { return `${QUESTION_IMPORT_COLUMNS.join(",")}\nCRE,,Biochemistry,,,single_mcq,Which enzyme is most specific for hepatocellular injury?,ALT,AST,ALP,GGT,A,ALT is comparatively specific for hepatocellular injury.,medium,1,0,standard,,,\n`; }

export function validateQuestionCsv(csv: string): ImportRow[] {
  const parsed = Papa.parse<Record<string,string>>(csv, { header:true, skipEmptyLines:"greedy", transformHeader:h=>h.trim().toLowerCase() });
  return parsed.data.map((raw,index) => {
    const errors: string[] = [];
    const type = types[(raw.question_type||"").trim().toLowerCase()];
    const sourceType = sources[(raw.source_type||"standard").trim().toLowerCase()];
    if (!raw.exam?.trim()) errors.push("exam is required");
    if (!raw.subject?.trim()) errors.push("subject is required");
    if (!raw.question?.trim()) errors.push("question is required");
    if (!type) errors.push("unsupported question_type");
    if (!sourceType) errors.push("unsupported source_type");
    const options = [raw.option_a,raw.option_b,raw.option_c,raw.option_d].filter(Boolean).map(x=>x.trim());
    const answerLetters = (raw.correct_answer||"").split(/[|,;]/).map(x=>x.trim().toUpperCase()).filter(Boolean);
    const correctAnswers = answerLetters.map(letter=>options[letter.charCodeAt(0)-65]).filter(Boolean);
    if (type && type !== "Case-based" && options.length < 2) errors.push("at least two options are required");
    if (!correctAnswers.length) errors.push("correct_answer must reference an available option (A-D)");
    const marks = Number(raw.marks||1), negativeMarks = Number(raw.negative_marks||0);
    if (!Number.isFinite(marks) || marks <= 0) errors.push("marks must be positive");
    if (!Number.isFinite(negativeMarks) || negativeMarks < 0) errors.push("negative_marks cannot be negative");
    return { row:index+2, valid:errors.length===0, errors, value:errors.length ? undefined : {
      id:crypto.randomUUID(), question:raw.question.trim(), type, exam:raw.exam.trim(), program:raw.program?.trim()||undefined,
      subject:raw.subject.trim(), chapter:raw.chapter?.trim()||undefined, topic:raw.topic?.trim()||undefined, options, correctAnswers,
      explanation:raw.explanation?.trim()||"", difficulty:(({easy:"Easy",medium:"Medium",hard:"Hard"}) as const)[(raw.difficulty||"medium").toLowerCase() as "easy"|"medium"|"hard"]||"Medium",
      marks, negativeMarks, sourceType, sourceReference:raw.source_reference?.trim()||undefined, examYear:raw.exam_year?Number(raw.exam_year):undefined, status:"Draft"
    } };
  });
}
