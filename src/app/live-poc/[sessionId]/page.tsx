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
  const [session, participant, messages] = await Promise.all([
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
  ]);
  if (session.error) notFound();
  return (
    <CloudflareClassroomPoc
      session={session.data}
      user={user}
      participant={participant.data}
      initialMessages={messages.data || []}
      configured={Boolean(
        process.env.CF_REALTIME_APP_ID && process.env.CF_REALTIME_APP_SECRET,
      )}
    />
  );
}
