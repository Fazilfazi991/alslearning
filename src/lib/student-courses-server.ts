import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { activeCourseEnrollment, selectedCourseSubject, type CourseEnrollment, type CourseSubject } from "./student-courses";
export type CourseRecording = { id: string; title: string; subject_id: string; chapter_id: string; topic_label: string | null; subtopic: string | null; provider_video_id: string | null; duration_seconds: number | null; chapters: { name: string } | null };

// Request-local reuse only; every query retains the student's session and RLS.
export const courseAccess = cache(async () => {
  const user = await requireRole(["student"]);
  const db = await createClient();
  const result = await db.from("enrollments")
    .select("id,status,batch_id,access_starts_at,access_expires_at,batches(id,name),programs(id,name,slug)")
    .eq("student_id", user.id).eq("status", "active").order("created_at", { ascending: false });
  if (result.error) throw new Error("Your courses could not be loaded. Please try again.");
  return { db, enrollments: (result.data as unknown as CourseEnrollment[] ?? []).filter(e => activeCourseEnrollment(e)) };
});
export async function getStudentCourse(slug: string, requestedSubject?: string) {
  const { db, enrollments } = await courseAccess();
  const enrollment = enrollments.find(e => e.programs?.slug === slug);
  if (!enrollment?.programs) return null;
  const program = enrollment.programs;
  const mapping = await db.from("program_subjects").select("subjects(id,name)").eq("program_id", program.id);
  if (mapping.error) throw new Error("Course subjects could not be loaded. Please try again.");
  const subjects = (mapping.data ?? []).flatMap(m => m.subjects ? [m.subjects] : []) as unknown as CourseSubject[];
  subjects.sort((a, b) => a.name.localeCompare(b.name));
  const selected = selectedCourseSubject(subjects, requestedSubject);
  const subjectIds = subjects.map(s => s.id);
  const [recordings, resources] = await Promise.all([
    subjectIds.length ? db.from("recorded_classes")
      .select("id,title,subject_id,chapter_id,topic_label,subtopic,provider_video_id,duration_seconds,chapters(name)")
      .eq("status", "published").in("subject_id", subjectIds).order("sort_order").order("id") : { data: [], error: null },
    subjectIds.length ? db.from("learning_content").select("id,title,kind,slug,subject_id")
      .eq("status", "active").eq("program_id", program.id).in("subject_id", subjectIds).order("display_order") : { data: [], error: null },
  ]);
  if (recordings.error || resources.error) throw new Error("Learning content could not be loaded. Please try again.");
  const counts = subjects.map(s => ({ subjectId: s.id, count: (recordings.data ?? []).filter(r => r.subject_id === s.id).length }));
  return { program, enrollment, subjects, selected, counts, recordings: (recordings.data ?? []) as unknown as CourseRecording[], resources: resources.data ?? [] };
}
export async function studentRecordingCount() {
  await requireRole(["student"]);
  const db = await createClient();
  const result = await db.from("recorded_classes").select("id", { head: true, count: "exact" }).eq("status", "published");
  if (result.error) throw new Error("Recorded class count could not be loaded. Please try again.");
  return result.count ?? 0;
}
