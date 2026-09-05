import type { AcademicWorkspace } from "@/types/academic";

export const academicSeed: AcademicWorkspace = {
  entities: [
    { id: "exam-cre", kind: "exam", name: "CRE – Common Recruitment Exam", slug: "cre", status: "Active", order: 1, metadata: { duration: "2 months" } },
    { id: "exam-lt2", kind: "exam", name: "Lab Technician Grade 2", slug: "lab-technician-grade-2", status: "Active", order: 2, metadata: { duration: "1 year" } },
    { id: "exam-msc", kind: "exam", name: "MSc MLT Entrance", slug: "msc-mlt-entrance", status: "Active", order: 3, metadata: { duration: "1 month" } },
    { id: "exam-jso", kind: "exam", name: "Junior Scientific Officer / JSO", slug: "jso", status: "Active", order: 4, metadata: { duration: "1 year" } },
    { id: "program-dhs", kind: "program", name: "DHS Long Term", slug: "dhs-long-term", status: "Active", order: 1, metadata: { accessValidity: "Configured per enrollment", recorded: true, live: true, tests: true } },
    { id: "program-dme", kind: "program", name: "DME Long Term", slug: "dme-long-term", status: "Active", order: 2, metadata: { accessValidity: "Configured per enrollment", recorded: true, live: true, tests: true } },
    { id: "program-msc", kind: "program", name: "MSc MLT Entrance", slug: "msc-mlt-entrance-program", parentId: "exam-msc", status: "Active", order: 3 },
    { id: "program-cre", kind: "program", name: "CRE Crash Course", slug: "cre-crash-course", parentId: "exam-cre", status: "Active", order: 4 },
    { id: "subject-biochem", kind: "subject", name: "Biochemistry", slug: "biochemistry", status: "Active", order: 1 },
    { id: "subject-micro", kind: "subject", name: "Microbiology", slug: "microbiology", status: "Active", order: 2 },
    { id: "subject-path", kind: "subject", name: "Pathology", slug: "pathology", status: "Active", order: 3 },
  ],
  questions: [],
};

export const QUESTION_IMPORT_COLUMNS = ["exam","program","subject","chapter","topic","question_type","question","option_a","option_b","option_c","option_d","correct_answer","explanation","difficulty","marks","negative_marks","source_type","source_reference","exam_year"];
