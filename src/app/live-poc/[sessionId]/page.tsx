import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CloudflareClassroomPoc } from "@/components/live/cloudflare-classroom-poc";
export default async function Page({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const user = await requireRole(["admin", "teacher", "student"]),
    { sessionId } = await params,
    db = await createClient();
  const [session, participant, messages, polls, questions] = await Promise.all([
    db
      .from("live_sessions")
      .select("id,title,faculty_id,status")
      .eq("id", sessionId)
      .single(),
    db
      .from("live_participants")
      .select(
        "presenter,audio_publish_allowed,screen_publish_allowed,raised_hand",
      )
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle(),
    db
      .from("live_messages")
      .select(
        "id,body,created_at,sender_id,profiles!live_messages_sender_id_fkey(full_name)",
      )
      .eq("session_id", sessionId)
      .order("created_at"),
    db.from("live_questions").select("id,question_id,launched_at,closed_at,show_results,questions(prompt,question_options!question_options_question_id_fkey(id,content,display_order)),live_question_responses(student_id,selected_option_ids)").eq("session_id",sessionId).order("launched_at",{ascending:false}),
    db.from("questions").select("id,prompt").eq("status","active").limit(100),
  ]);
  if (session.error) notFound();
  return (
    <CloudflareClassroomPoc
      session={session.data}
      user={user}
      participant={participant.data}
      initialMessages={messages.data || []}
      initialPolls={polls.data || []}
      availableQuestions={questions.data || []}
      configured={Boolean(
        process.env.CF_REALTIME_APP_ID && process.env.CF_REALTIME_APP_SECRET,
      )}
    />
  );
}
