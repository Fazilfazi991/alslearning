import "server-only";
import { createClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/auth";
export async function getStudentPortalData() {
  const user = await currentUser();
  if (!user) return null;
  const db = await createClient();
  const [enrollments, content, sessions, tests, progress, attempts] =
    await Promise.all([
      db
        .from("enrollments")
        .select(
          "*,programs(id,name,slug,description,duration_days),batches(id,name,starts_on,ends_on)",
        )
        .eq("student_id", user.id)
        .order("created_at", { ascending: false }),
      db
        .from("learning_content")
        .select(
          "id,title,description,kind,slug,duration_seconds,program_id,subject_id,chapter_id,topic_id,external_url,allow_download",
        )
        .eq("status", "active")
        .order("display_order"),
      db
        .from("live_sessions")
        .select(
          "id,title,starts_at,ends_at,status,provider,provider_room_id,program_id,batch_id,subjects(name),topics(name),profiles!live_sessions_faculty_id_fkey(full_name)",
        )
        .in("status", ["scheduled", "live"])
        .order("starts_at"),
      db
        .from("tests")
        .select(
          "id,title,slug,type,duration_minutes,question_count,total_marks,available_from,available_until,program_id",
        )
        .eq("status", "active")
        .order("available_from"),
      db
        .from("video_progress")
        .select("content_id,position_seconds,completed,updated_at")
        .eq("student_id", user.id),
      db
        .from("test_attempts")
        .select("id,test_id,started_at,submitted_at,score,status")
        .eq("student_id", user.id)
        .order("started_at", { ascending: false }),
    ]);
  const error = [
    enrollments,
    content,
    sessions,
    tests,
    progress,
    attempts,
  ].find((x) => x.error)?.error;
  if (error) throw new Error(error.message);
  return {
    user,
    enrollments: enrollments.data || [],
    content: content.data || [],
    sessions: sessions.data || [],
    tests: tests.data || [],
    progress: progress.data || [],
    attempts: attempts.data || [],
  };
}

export async function getCourseDetail(slug: string) {
  const user = await currentUser();
  if (!user) return null;
  const db = await createClient();
  const { data: program, error } = await db
    .from("programs")
    .select(
      "id,name,slug,description,program_subjects(subjects(id,name)),batches(id,name)",
    )
    .eq("slug", slug)
    .single();
  if (error) return null;
  const { data: enrollment } = await db
    .from("enrollments")
    .select("id,status,batch_id,access_starts_at,access_expires_at")
    .eq("student_id", user.id)
    .eq("program_id", program.id)
    .eq("status", "active")
    .maybeSingle();
  if (!enrollment) return null;
  const [chapters, topics, content, faculty] = await Promise.all([
    db
      .from("chapters")
      .select("id,name,subject_id,display_order")
      .or(`program_id.eq.${program.id},program_id.is.null`)
      .order("display_order"),
    db
      .from("topics")
      .select("id,name,subject_id,chapter_id,display_order")
      .or(`program_id.eq.${program.id},program_id.is.null`)
      .order("display_order"),
    db
      .from("learning_content")
      .select(
        "id,title,description,kind,slug,duration_seconds,subject_id,chapter_id,topic_id,faculty_id,allow_download",
      )
      .eq("program_id", program.id)
      .eq("status", "active")
      .order("display_order"),
    db
      .from("faculty_assignments")
      .select(
        "faculty_id,profiles!faculty_assignments_faculty_id_fkey(full_name)",
      )
      .eq("program_id", program.id),
  ]);
  for (const x of [chapters, topics, content, faculty])
    if (x.error) throw new Error(x.error.message);
  return {
    program,
    enrollment,
    chapters: chapters.data || [],
    topics: topics.data || [],
    content: content.data || [],
    faculty: faculty.data || [],
  };
}

export async function getLearningContent(slug: string) {
  const user = await currentUser();
  if (!user) return null;
  const db = await createClient();
  const { data, error } = await db
    .from("learning_content")
    .select("*,programs(name,slug),subjects(name),chapters(name),topics(name)")
    .eq("slug", slug)
    .eq("status", "active")
    .single();
  if (error) return null;
  let sourceUrl = data.external_url as string | null;
  if (data.storage_bucket && data.storage_path) {
    const signed = await db.storage
      .from(data.storage_bucket)
      .createSignedUrl(data.storage_path, 900, { download: false });
    if (signed.error) throw new Error(signed.error.message);
    sourceUrl = signed.data.signedUrl;
  }
  const [progress, checkpoints, siblings] = await Promise.all([
    db
      .from("video_progress")
      .select("position_seconds,completed")
      .eq("content_id", data.id)
      .eq("student_id", user.id)
      .maybeSingle(),
    db
      .from("video_checkpoints")
      .select(
        "id,trigger_seconds,pause_video,mandatory,retry_policy,show_feedback,question_id,questions(prompt,explanation,question_options(id,content,display_order))",
      )
      .eq("video_id", data.id)
      .order("trigger_seconds"),
    db
      .from("learning_content")
      .select("id,slug,title,display_order")
      .eq("program_id", data.program_id)
      .eq("status", "active")
      .order("display_order"),
  ]);
  for (const x of [progress, checkpoints, siblings])
    if (x.error) throw new Error(x.error.message);
  return {
    user,
    content: data,
    sourceUrl,
    progress: progress.data,
    checkpoints: checkpoints.data || [],
    siblings: siblings.data || [],
  };
}

export async function getTestForStudent(slug: string) {
  const user = await currentUser();
  if (!user) return null;
  const db = await createClient();
  const { data: test, error } = await db
    .from("tests")
    .select(
      "*,test_questions(display_order,marks_override,negative_marks_override,questions(id,prompt,type,question_options(id,content,display_order)))",
    )
    .eq("slug", slug)
    .eq("status", "active")
    .single();
  if (error) return null;
  const { data: attempts } = await db
    .from("test_attempts")
    .select("id,status,started_at,expires_at,submitted_at,score,question_order,correct_count,incorrect_count,unanswered_count,negative_marks_total,attempt_answers(question_id,selected_option_ids)")
    .eq("test_id", test.id)
    .eq("student_id", user.id)
    .order("started_at", { ascending: false });
  return { user, test, attempts: attempts || [] };
}
