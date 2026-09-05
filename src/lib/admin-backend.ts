import { createClient } from "@/lib/supabase/client";

export async function loadAdminData() {
  const db = createClient();
  const [
    profiles,
    programs,
    batches,
    subjects,
    chapters,
    topics,
    enrollments,
    assignments,
    batchFaculty,
    content,
    questions,
    tests,
    checkpoints,
  ] = await Promise.all([
    db
      .from("profiles")
      .select("id,full_name,email,role,is_active")
      .order("full_name"),
    db.from("programs").select("id,name,exam_id,status").order("name"),
    db.from("batches").select("id,name,program_id,status").order("name"),
    db.from("subjects").select("id,name").order("name"),
    db.from("chapters").select("id,name,subject_id").order("name"),
    db.from("topics").select("id,name,subject_id,chapter_id").order("name"),
    db
      .from("enrollments")
      .select("*")
      .order("created_at", { ascending: false }),
    db
      .from("faculty_assignments")
      .select("*")
      .order("created_at", { ascending: false }),
    db.from("batch_faculty").select("*"),
    db.from("learning_content").select("*").order("display_order"),
    db
      .from("questions")
      .select("id,prompt,subject_id,status")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(200),
    db
      .from("tests")
      .select("*,test_questions(question_id),test_batches(batch_id)")
      .order("created_at", { ascending: false }),
    db
      .from("video_checkpoints")
      .select("*,questions(prompt),learning_content(title)")
      .order("trigger_seconds"),
  ]);
  for (const result of [
    profiles,
    programs,
    batches,
    subjects,
    chapters,
    topics,
    enrollments,
    assignments,
    batchFaculty,
    content,
    questions,
    tests,
    checkpoints,
  ])
    if (result.error) throw new Error(result.error.message);
  return {
    profiles: profiles.data || [],
    programs: programs.data || [],
    batches: batches.data || [],
    subjects: subjects.data || [],
    chapters: chapters.data || [],
    topics: topics.data || [],
    enrollments: enrollments.data || [],
    assignments: assignments.data || [],
    batchFaculty: batchFaculty.data || [],
    content: content.data || [],
    questions: questions.data || [],
    tests: tests.data || [],
    checkpoints: checkpoints.data || [],
  };
}
export type AdminData = Awaited<ReturnType<typeof loadAdminData>>;
function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
export async function saveEnrollment(value: Record<string, unknown>) {
  const db = createClient();
  const id = typeof value.id === "string" ? value.id : null;
  const mutation = id
    ? db.from("enrollments").update(value).eq("id", id)
    : db.from("enrollments").insert(value);
  const { error } = await mutation;
  fail(error);
}
export async function setFacultyActive(id: string, is_active: boolean) {
  const { error } = await createClient()
    .from("profiles")
    .update({ is_active })
    .eq("id", id);
  fail(error);
}
export async function saveFacultyAssignment(value: Record<string, unknown>) {
  const { error } = await createClient()
    .from("faculty_assignments")
    .insert(value);
  fail(error);
}
export async function removeFacultyAssignment(id: string) {
  const { error } = await createClient()
    .from("faculty_assignments")
    .delete()
    .eq("id", id);
  fail(error);
}
export async function saveBatchFaculty(batch_id: string, faculty_id: string) {
  const { error } = await createClient()
    .from("batch_faculty")
    .upsert({ batch_id, faculty_id });
  fail(error);
}
export async function removeBatchFaculty(batch_id: string, faculty_id: string) {
  const { error } = await createClient()
    .from("batch_faculty")
    .delete()
    .match({ batch_id, faculty_id });
  fail(error);
}
export async function saveContent(value: Record<string, unknown>) {
  const { error } = await createClient().from("learning_content").upsert(value);
  fail(error);
}
export async function deleteContent(row: {
  id: string;
  storage_bucket?: string | null;
  storage_path?: string | null;
}) {
  const db = createClient();
  const [progress,checkpoints]=await Promise.all([db.from("video_progress").select("content_id",{count:"exact",head:true}).eq("content_id",row.id),db.from("video_checkpoints").select("id",{count:"exact",head:true}).eq("video_id",row.id)]);
  fail(progress.error);fail(checkpoints.error);
  if((progress.count||0)>0||(checkpoints.count||0)>0)throw new Error("This content has learning history or checkpoints. Archive it instead.");
  const { error } = await db.from("learning_content").delete().eq("id", row.id);
  fail(error);
  if (row.storage_bucket && row.storage_path) {
    const removed = await db.storage
      .from(row.storage_bucket)
      .remove([row.storage_path]);
    fail(removed.error);
  }
}
export async function uploadMaterial(file: File, path: string) {
  const db = createClient(),
    bucket = "learning-content";
  const result = await db.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type, upsert: false });
  fail(result.error);
  return { bucket, path, mime_type: file.type, byte_size: file.size };
}
export async function replaceMaterial(
  file: File,
  row: { id: string; storage_bucket?: string | null; storage_path?: string | null },
) {
  const nextPath = `content/${row.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  const uploaded = await uploadMaterial(file, nextPath);
  try {
    await saveContent({
      id: row.id,
      storage_bucket: uploaded.bucket,
      storage_path: uploaded.path,
      mime_type: uploaded.mime_type,
      byte_size: uploaded.byte_size,
    });
  } catch (error) {
    await createClient().storage.from(uploaded.bucket).remove([uploaded.path]);
    throw error;
  }
  if (row.storage_bucket && row.storage_path)
    fail((await createClient().storage.from(row.storage_bucket).remove([row.storage_path])).error);
}
export async function saveTest(
  value: Record<string, unknown>,
  questionIds: string[],
  batchIds: string[],
) {
  const db = createClient();
  const { data, error } = await db
    .from("tests")
    .upsert(value)
    .select("id")
    .single();
  fail(error);
  if (!data) throw new Error("Test could not be saved");
  const id = data.id;
  fail((await db.from("test_questions").delete().eq("test_id", id)).error);
  fail((await db.from("test_batches").delete().eq("test_id", id)).error);
  if (questionIds.length)
    fail(
      (
        await db
          .from("test_questions")
          .insert(
            questionIds.map((question_id, display_order) => ({
              test_id: id,
              question_id,
              display_order,
            })),
          )
      ).error,
    );
  if (batchIds.length)
    fail(
      (
        await db
          .from("test_batches")
          .insert(batchIds.map((batch_id) => ({ test_id: id, batch_id })))
      ).error,
    );
}
export async function saveCheckpoint(value: Record<string, unknown>) {
  const { error } = await createClient()
    .from("video_checkpoints")
    .upsert(value);
  fail(error);
}
