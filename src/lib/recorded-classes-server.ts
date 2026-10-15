import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { orderRecordings, type Recording, type RecordingSubject, type RecordingTopic } from "./recorded-classes";

export type CatalogRecording = Omit<Recording,"provider"> & {provider:"youtube"|"native"|"live";session_id:string|null;program_id:string|null;batch_id:string|null};
const columns = "id,subject_id,chapter_id,topic_label,subtopic,title,description,provider,provider_video_id,status,sort_order,duration_seconds,thumbnail_url,teacher_id,updated_at,published_at,storage_provider,storage_key,source_storage_key,poster_storage_key,mime_type,file_size,width,height,checksum_sha256,original_provider,original_provider_video_id,session_id,program_id,batch_id";
export async function studentRecordings() {
  await requireRole(["student"]);
  const db = await createClient();
  // RLS is authoritative, including for direct REST calls and expired access.
  const result = await db.from("lms_class_catalog").select(columns).eq("status", "published").order("sort_order");
  if (result.error) throw new Error("Recorded classes could not be loaded. Please try again.");
  const recordings = (result.data ?? []).map(r=>({...r,chapter_id:r.chapter_id || `live-${r.subject_id}`})) as CatalogRecording[];
  if (!recordings.length) return { recordings, subjects: [] as RecordingSubject[], topics: [] as RecordingTopic[], teachers: [] as RecordingSubject[] };
  const teacherIds = [...new Set(recordings.map(r => r.teacher_id).filter((id): id is string => !!id))];
  const [subjects, topics, teachers] = await Promise.all([
    db.from("subjects").select("id,name").in("id", [...new Set(recordings.map(r => r.subject_id))]).order("name"),
    db.from("chapters").select("id,name,subject_id,display_order").in("id", [...new Set(recordings.filter(r=>r.provider!=="live").map(r => r.chapter_id))]).order("display_order"),
    teacherIds.length ? db.from("profiles").select("id,full_name").in("id", teacherIds) : Promise.resolve({data: [], error: null}),
  ]);
  if (subjects.error || topics.error || teachers.error) throw new Error("Recorded classes could not be loaded. Please try again.");
  const liveTopics=recordings.filter(r=>r.provider==="live").map(r=>({id:r.chapter_id,name:"Live classes",subject_id:r.subject_id,display_order:0}));
  return { recordings: orderRecordings(recordings as Recording[], topics.data ?? []) as unknown as CatalogRecording[], subjects: subjects.data ?? [], topics: [...(topics.data ?? []),...new Map(liveTopics.map(t=>[t.id,t])).values()], teachers: (teachers.data ?? []).map(t => ({id:t.id,name:t.full_name ?? "Teacher"})) };
}
