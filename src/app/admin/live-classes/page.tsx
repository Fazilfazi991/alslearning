import { AdminShell } from "@/components/admin/admin-shell";
import { LiveClassesManager } from "@/components/admin/live-classes-manager";
import { createClient } from "@/lib/supabase/server";
import { liveClassConfiguration } from "@/lib/live-class/config";

export default async function Page() {
  const db = await createClient();
  const [programs, subjects, batches, teachers, sessions, usage, attendance] = await Promise.all([
    db.from("programs").select("id,name").eq("status", "active").order("name"),
    db.from("subjects").select("id,name").eq("status", "active").order("name"),
    db.from("batches").select("id,name,program_id").in("status", ["upcoming", "active"]).order("name"),
    db.from("profiles").select("id,full_name,email").eq("role", "teacher").eq("is_active", true).order("full_name"),
    db.from("live_sessions").select("id,title,status,starts_at,ends_at,recording_enabled,max_receivers,programs(name),subjects(name),batches(name),profiles!live_sessions_faculty_id_fkey(full_name),class_recordings(id,status,total_bytes,duration_seconds,client_validated_at,verified_at,published_at,error_message)").eq("provider", "cloudflare").order("starts_at", { ascending: false }).limit(100),
    db.from("live_usage_summaries").select("audio_bytes,video_bytes,screen_bytes").limit(10000),
    db.from("live_attendance_intervals").select("session_id,user_id,started_at,ended_at").limit(10000),
  ]);
  const failure = [programs, subjects, batches, teachers, sessions, usage, attendance].find(result => result.error);
  if (failure?.error) throw new Error(failure.error.message);
  const usageBytes = (usage.data || []).reduce((sum, row) => sum + Number(row.audio_bytes || 0) + Number(row.video_bytes || 0) + Number(row.screen_bytes || 0), 0);
  const attendanceBySession = new Map<string, { users: Set<string>; seconds: number }>();
  for (const interval of attendance.data || []) {
    const value = attendanceBySession.get(interval.session_id) || { users: new Set<string>(), seconds: 0 };
    value.users.add(interval.user_id);
    value.seconds += Math.max(0, (Date.parse(interval.ended_at || new Date().toISOString()) - Date.parse(interval.started_at)) / 1000);
    attendanceBySession.set(interval.session_id, value);
  }
  const hydratedSessions = (sessions.data || []).map(session => {
    const value = attendanceBySession.get(session.id);
    return { ...session, attendeeCount: value?.users.size || 0, attendanceSeconds: value?.seconds || 0 };
  });
  return <AdminShell><LiveClassesManager
    programs={(programs.data || []) as never}
    subjects={(subjects.data || []) as never}
    batches={(batches.data || []) as never}
    teachers={(teachers.data || []).map(value => ({ id: value.id, name: value.full_name || value.email || "Teacher", email: value.email }))}
    sessions={hydratedSessions as never}
    usageBytes={usageBytes}
    configuration={liveClassConfiguration()}
    timeZone={process.env.ALS_ACADEMIC_TIME_ZONE || "Asia/Dubai"}
  /></AdminShell>;
}
