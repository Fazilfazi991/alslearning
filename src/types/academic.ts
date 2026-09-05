export type RecordStatus = "Draft" | "Active" | "Archived";
export type AcademicEntityKind = "program" | "exam" | "subject" | "chapter" | "topic" | "batch" | "video" | "material" | "question" | "test";

export interface AcademicEntity {
  id: string;
  kind: AcademicEntityKind;
  name: string;
  slug: string;
  parentId?: string;
  status: RecordStatus;
  order: number;
  description?: string;
  metadata?: Record<string, string | number | boolean | string[]>;
}

export type QuestionType = "Single-answer MCQ" | "Multiple-answer MCQ" | "True / False" | "Image-based MCQ" | "Case-based" | "Match-the-following";
export type QuestionSource = "Standard" | "Previous exam" | "Recalled";

export interface AcademicQuestion {
  id: string;
  question: string;
  type: QuestionType;
  exam: string;
  program?: string;
  subject: string;
  chapter?: string;
  topic?: string;
  options: string[];
  correctAnswers: string[];
  explanation: string;
  difficulty: "Easy" | "Medium" | "Hard";
  marks: number;
  negativeMarks: number;
  sourceType: QuestionSource;
  sourceReference?: string;
  examYear?: number;
  status: RecordStatus;
}

export interface AcademicWorkspace {
  entities: AcademicEntity[];
  questions: AcademicQuestion[];
}
