import type { RichText } from "./rich-text";
import type { QuestionMedia } from "./question-media";
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
  prompt_rich?: RichText | null;
  explanation_rich?: RichText | null;
  media?: QuestionMedia[];
  options: {
    content: string;
    correct: boolean;
    content_rich?: RichText | null;
  }[];
};
export type Test = Taxonomy & {
  id: string;
  title: string;
  type: string;
  duration_minutes: number;
  question_count: number;
  total_marks: number;
  default_negative_marks: number;
  max_attempts: number | null;
  internal_description: string;
  instructions: string;
  target_score: number | null;
  pass_percentage: number | null;
  available_from: string;
  available_until: string;
  randomize_questions: boolean;
  randomize_options: boolean;
  show_results: boolean;
  show_answers: boolean;
  show_explanations: boolean;
  selection_mode: string;
  selection_rules: { difficulty?: string; scopes?: { subject_id: string; chapter_ids: string[]; count?: number }[] };
  status: string;
  question_ids: string[];
  batch_ids: string[];
  created_at?: string;
  updated_at?: string;
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
  type: "practice",
  duration_minutes: 30,
  question_count: 1,
  total_marks: 0,
  default_negative_marks: 0,
  max_attempts: 1,
  internal_description: "",
  instructions: "",
  target_score: null,
  pass_percentage: null,
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
export async function loadCoreData(mode: "questions" | "tests" | "content", actor?: {id:string;role:string}): Promise<CoreData> {
  if (mode === "tests") return (await import("./test-repository")).loadTestWorkspace(actor);
  if (mode === "questions") throw new Error("Use the paginated Question Bank workspace.");
  const db = createClient();
  let identity=actor;
  if(!identity){
    const auth=await db.auth.getUser();
    check(auth.error);
    if(!auth.data.user)throw new Error("Sign in to continue.");
    const profile=await db.from("profiles").select("role,is_active").eq("id",auth.data.user.id).single();
    check(profile.error);
    if(!profile.data?.is_active)throw new Error("Account is inactive.");
    identity={id:auth.data.user.id,role:profile.data.role};
  }
  const [academic,content,assignments]=await Promise.all([
    import("./test-repository").then(repository=>repository.loadAcademicMetadata(identity.id)),
    db.from("learning_content").select("*,content_batch_access(batch_id)").order("display_order"),
    db.from("faculty_assignments").select("exam_id,program_id,subject_id,can_manage_content,can_manage_questions,can_manage_tests"),
  ]);
  check(content.error);check(assignments.error);
  return {
    ...academic,
    assignments: assignments.data || [],
    role: identity.role,
    questions: [],
    tests: [],
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
