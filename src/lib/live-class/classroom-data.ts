import "server-only";
import { createClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/auth";
import { assertClassroomMode, authorizeLiveClass } from "./authorization";
import { liveClassConfiguration } from "./config";
import { stagingTestWindowOpen } from "./staging-window";

export async function getClassroomData(classId: string, mode: "poc" | "classroom") {
  const user = await currentUser();
  if (!user) return null;
  const db = await createClient();
  const authorization = await authorizeLiveClass(db, user.id, classId, "view");
  assertClassroomMode(authorization.session, mode);
  const [session, participant, participants, messages, polls, questions, recordings] = await Promise.all([
    db.rpc("live_session_payload", { target_session: classId }).single(),
    db.from("live_participants").select("presenter,audio_publish_allowed,screen_publish_allowed,raised_hand,removed_at").eq("session_id", classId).eq("user_id", user.id).maybeSingle(),
    authorization.isClassManager
      ? db.rpc("live_participant_roster", { target_session: classId })
      : Promise.resolve({ data: [], error: null }),
    db.rpc("live_message_page", {
      target_session: classId,
      before_created_at: null,
      before_id: null,
      page_size: 50,
    }),
    db.rpc("live_poll_payload", { target_session: classId }),
    authorization.isClassManager && authorization.session.subject_id
      ? db.from("questions").select("id,prompt").eq("subject_id", authorization.session.subject_id).eq("status", "active").limit(100)
      : Promise.resolve({ data: [], error: null }),
    db.from("class_recordings").select("id,status,mime_type,total_bytes,duration_seconds,verified_at,published_at,error_message,created_at").eq("session_id", classId).order("created_at", { ascending: false }),
  ]);
  const failed = [session, participant, participants, messages, polls, questions, recordings].find(result => result.error);
  if (failed?.error || !session.data) throw new Error(failed?.error?.message || "Classroom is unavailable");
  const configuration = liveClassConfiguration();
  const windowStart = Date.parse(process.env.ALS_STAGING_TEST_START_UTC || "");
  const windowEnd = Date.parse(process.env.ALS_STAGING_TEST_CUTOFF_UTC || "");
  const testingWindow = {
    opensAt: Number.isFinite(windowStart) ? new Date(windowStart).toISOString() : null,
    closesAt: Number.isFinite(windowEnd) ? new Date(windowEnd).toISOString() : null,
  };
  const publicSession = session.data as unknown as {
    id: string; title: string; faculty_id: string; status: string; starts_at: string | null; ends_at: string | null;
    program_id: string | null; batch_id: string | null; subject_id: string | null; recording_enabled: boolean; provider: string;
    program_name: string | null; batch_name: string | null; subject_name: string | null; teacher_name: string | null;
  };
  return {
    user,
    authorization,
    session: {
      ...publicSession,
      programs: publicSession.program_name ? { name: publicSession.program_name } : null,
      batches: publicSession.batch_name ? { name: publicSession.batch_name } : null,
      subjects: publicSession.subject_name ? { name: publicSession.subject_name } : null,
      profiles: publicSession.teacher_name ? { full_name: publicSession.teacher_name } : null,
    },
    participant: participant.data,
    participants: participants.data || [],
    messages: messages.data || [],
    polls: polls.data || [],
    availableQuestions: questions.data || [],
    recordings: recordings.data || [],
    mode,
    timeZone: process.env.ALS_ACADEMIC_TIME_ZONE || "Asia/Dubai",
    configuration,
    testingWindow,
    entryEnabled: (mode === "poc" ? configuration.pocEnabled : configuration.classroomEnabled) && stagingTestWindowOpen(),
  };
}
