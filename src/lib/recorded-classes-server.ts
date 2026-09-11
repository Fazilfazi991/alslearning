import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { orderRecordings, type Recording, type RecordingSubject, type RecordingTopic } from "./recorded-classes";

const columns = "id,subject_id,chapter_id,topic_label,subtopic,title,description,provider,provider_video_id,status,sort_order,duration_seconds,thumbnail_url,teacher_id,updated_at,published_at";
export async function studentRecordings() {
  await requireRole(["student"]);
  const db = await createClient();
  // RLS is authoritative, including for direct REST calls and expired access.
  const result = await db.from("recorded_classes").select(columns).eq("status", "published").order("sort_order");
  if (result.error) throw new Error("Recorded classes could not be loaded. Please try again.");
  const recordings = (result.data ?? []) as Recording[];
  if (!recordings.length) return { recordings, subjects: [] as RecordingSubject[], topics: [] as RecordingTopic[], teachers: [] as RecordingSubject[] };
  const teacherIds = [...new Set(recordings.map(r => r.teacher_id).filter((id): id is string => !!id))];
  const [subjects, topics, teachers] = await Promise.all([
    db.from("subjects").select("id,name").in("id", [...new Set(recordings.map(r => r.subject_id))]).order("name"),
    db.from("chapters").select("id,name,subject_id,display_order").in("id", [...new Set(recordings.map(r => r.chapter_id))]).order("display_order"),
    teacherIds.length ? db.from("profiles").select("id,full_name").in("id", teacherIds) : Promise.resolve({data: [], error: null}),
  ]);
  if (subjects.error || topics.error || teachers.error) throw new Error("Recorded classes could not be loaded. Please try again.");
  return { recordings: orderRecordings(recordings, topics.data ?? []), subjects: subjects.data ?? [], topics: topics.data ?? [], teachers: (teachers.data ?? []).map(t => ({id:t.id,name:t.full_name ?? "Teacher"})) };
}
