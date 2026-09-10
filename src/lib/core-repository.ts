import { createClient } from "./supabase/client";

export type Lookup = {
  id: string;
  name: string;
  exam_id?: string | null;
  program_id?: string | null;
  subject_id?: string;
  chapter_id?: string | null;
};
export type Taxonomy = {
  exam_id: string;
  program_id: string;
  subject_id: string;
  chapter_id: string;
  topic_id: string;
};
export type Question = Taxonomy & {
  id: string;
  prompt: string;
  type: string;
  explanation: string;
  difficulty: string;
  marks: number;
  negative_marks: number;
  source_type: string;
  source_reference: string;
  exam_year: string;
  exam_session: string;
  source_label: string;
  status: string;
  stem_image_path: string;
  explanation_image_path: string;
  options: { content: string; correct: boolean }[];
};
export type Test = Taxonomy & {
  id: string;
  title: string;
  type: string;
  duration_minutes: number;
  question_count: number;
  total_marks: number;
  default_negative_marks: number;
  max_attempts: number;
  available_from: string;
  available_until: string;
  randomize_questions: boolean;
  randomize_options: boolean;
  show_results: boolean;
  show_answers: boolean;
  show_explanations: boolean;
  selection_mode: string;
  selection_rules: { difficulty?: string };
  status: string;
  question_ids: string[];
  batch_ids: string[];
};
export type Content = Taxonomy & {
  id: string;
  title: string;
  kind: string;
  description: string;
  external_url: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  byte_size: number | null;
  allow_download: boolean;
  status: string;
  display_order: number;
  batch_ids: string[];
};
export type Assignment = {
  exam_id: string | null;
  program_id: string | null;
  subject_id: string | null;
  can_manage_content: boolean;
  can_manage_questions: boolean;
  can_manage_tests: boolean;
};
export type CoreData = {
  exams: Lookup[];
  programs: Lookup[];
  subjects: Lookup[];
  chapters: Lookup[];
  topics: Lookup[];
  batches: Lookup[];
  questions: Question[];
  tests: Test[];
  content: Content[];
  role: string;
  assignments: Assignment[];
  mappings: { program_id: string; subject_id: string }[];
};
export const emptyTaxonomy: Taxonomy = {
  exam_id: "",
  program_id: "",
  subject_id: "",
  chapter_id: "",
  topic_id: "",
};
export const newQuestion = (): Question => ({
  ...emptyTaxonomy,
  id: crypto.randomUUID(),
  prompt: "",
  type: "single_mcq",
  explanation: "",
  difficulty: "medium",
  marks: 1,
  negative_marks: 0,
  source_type: "standard",
  source_reference: "",
  exam_year: "",
  exam_session: "",
  source_label: "",
  status: "draft",
  stem_image_path: "",
  explanation_image_path: "",
  options: Array.from({ length: 4 }, (_, i) => ({
    content: "",
    correct: i === 0,
  })),
});
export const newTest = (): Test => ({
  ...emptyTaxonomy,
  id: crypto.randomUUID(),
  title: "",
  type: "mock",
  duration_minutes: 30,
  question_count: 1,
  total_marks: 0,
  default_negative_marks: 0,
  max_attempts: 1,
  available_from: "",
  available_until: "",
  randomize_questions: false,
  randomize_options: false,
  show_results: true,
  show_answers: true,
  show_explanations: true,
  selection_mode: "manual",
  selection_rules: {},
  status: "draft",
  question_ids: [],
  batch_ids: [],
});
export const newContent = (): Content => ({
  ...emptyTaxonomy,
  id: crypto.randomUUID(),
  title: "",
  kind: "video",
  description: "",
  external_url: "",
  storage_bucket: "",
  storage_path: "",
  mime_type: "",
  byte_size: null,
  allow_download: false,
  status: "draft",
  display_order: 0,
  batch_ids: [],
});
const check = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};
async function all<T>(
  fetch: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const r = await fetch(offset, offset + 499);
    check(r.error);
    rows.push(...(r.data || []));
    if ((r.data?.length || 0) < 500) break;
  }
  return { data: rows, error: null };
}
export function canManage(
  data: CoreData,
  mode: "questions" | "tests" | "content",
  target?: Taxonomy,
) {
  return (
    data.role === "admin" ||
    (data.role === "teacher" &&
      data.assignments.some(
        (a) =>
          a[
            mode === "questions"
              ? "can_manage_questions"
              : mode === "tests"
                ? "can_manage_tests"
                : "can_manage_content"
          ] &&
          (!target ||
            ((!a.exam_id || a.exam_id === target.exam_id) &&
              (!a.program_id || a.program_id === target.program_id) &&
              (!a.subject_id || a.subject_id === target.subject_id))),
      ))
  );
}
export async function loadCoreData(): Promise<CoreData> {
  const db = createClient();
  const [
    exams,
    programs,
    subjects,
    chapters,
    topics,
    batches,
    questions,
    tests,
    content,
    profile,
    assignments,
    mappings,
    bank,
  ] = await Promise.all([
    all((from, to) =>
      db.from("entrance_exams").select("*").order("name").range(from, to),
    ),
    all((from, to) =>
      db.from("programs").select("*").order("name").range(from, to),
    ),
    all((from, to) =>
      db.from("subjects").select("*").order("name").range(from, to),
    ),
    all((from, to) =>
      db.from("chapters").select("*").order("name").range(from, to),
    ),
    all((from, to) =>
      db.from("topics").select("*").order("name").range(from, to),
    ),
    all((from, to) =>
      db.from("batches").select("*").order("name").range(from, to),
    ),
    all((from, to) =>
      db
        .from("questions")
        .select(
          "*,question_options!question_options_question_id_fkey(id,content,display_order),question_answer_keys(option_id)",
        )
        .order("created_at", { ascending: false })
        .range(from, to),
    ),
    all((from, to) =>
      db
        .from("tests")
        .select("*,test_questions(question_id),test_batches(batch_id)")
        .order("created_at", { ascending: false })
        .range(from, to),
    ),
    all((from, to) =>
      db
        .from("learning_content")
        .select("*,content_batch_access(batch_id)")
        .order("display_order")
        .range(from, to),
    ),
    db.auth.getUser(),
    db.from("faculty_assignments").select("*"),
    db.from("program_subjects").select("program_id,subject_id"),
    db.rpc("core_test_bank"),
  ]);
  for (const r of [
    exams,
    programs,
    subjects,
    chapters,
    topics,
    batches,
    questions,
    tests,
    content,
    assignments,
    mappings,
    bank,
  ])
    check(r.error);
  return {
    assignments: assignments.data || [],
    mappings: mappings.data || [],
    exams: exams.data || [],
    programs: programs.data || [],
    subjects: subjects.data || [],
    chapters: chapters.data || [],
    topics: topics.data || [],
    batches: batches.data || [],
    role: profile.data.user?.app_metadata.role || "",
    questions: [
      ...(bank.data || []),
      ...(questions.data || []).map((q) => ({
        ...q,
        exam_year: q.exam_year?.toString() || "",
        options: q.question_options
          .sort(
            (a: { display_order: number }, b: { display_order: number }) =>
              a.display_order - b.display_order,
          )
          .map((o: { id: string; content: string }) => ({
            content: o.content,
            correct: q.question_answer_keys.some(
              (k: { option_id: string }) => k.option_id === o.id,
            ),
          })),
      })),
    ].filter(
      (q, i, items) => items.findLastIndex((x) => x.id === q.id) === i,
    ) as Question[],
    tests: (tests.data || []).map((t) => ({
      ...t,
      question_ids: t.test_questions.map(
        (x: { question_id: string }) => x.question_id,
      ),
      batch_ids: t.test_batches.map((x: { batch_id: string }) => x.batch_id),
    })) as Test[],
    content: (content.data || []).map((c) => ({
      ...c,
      batch_ids: c.content_batch_access.map(
        (x: { batch_id: string }) => x.batch_id,
      ),
    })) as Content[],
  };
}
function payload(value: object) {
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, v === "" ? null : v]),
  );
}
export async function saveCoreQuestion(value: Question) {
  check(
    (await createClient().rpc("core_save_question", { value: payload(value) }))
      .error,
  );
}
export async function saveCoreTest(value: Test) {
  check(
    (
      await createClient().rpc("core_save_test", {
        value: payload(value),
        question_ids: value.question_ids,
        batch_ids: value.batch_ids,
      })
    ).error,
  );
}
export async function saveCoreContent(value: Content) {
  check(
    (
      await createClient().rpc("core_save_content", {
        value: payload(value),
        batch_ids: value.batch_ids,
      })
    ).error,
  );
}
export async function moveCoreContent(id: string, direction: number) {
  check(
    (await createClient().rpc("core_move_content", { target: id, direction }))
      .error,
  );
}
export async function uploadCoreFile(file: File, bucket: string, id: string) {
  const db = createClient();
  const user = await db.auth.getUser();
  if (!user.data.user) throw new Error("Sign in required");
  const path = `${user.data.user.id}/${id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  check(
    (
      await db.storage
        .from(bucket)
        .upload(path, file, { contentType: file.type })
    ).error,
  );
  return path;
}
