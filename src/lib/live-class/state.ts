export type LiveClassState = "draft" | "scheduled" | "join_window_open" | "live" | "ended" | "cancelled";
export type ClassStateInput = { status: string; ended_at?: string | null; join_opens_at?: string | null };
/** Run on the server for access decisions. A genuine manual start wins over the schedule. */
export function resolveLiveClassState(session: ClassStateInput, now = Date.now()): LiveClassState {
  if (session.status === "cancelled") return "cancelled";
  if (session.status === "completed" || session.ended_at) return "ended";
  if (session.status === "live") return "live";
  if (session.status === "scheduled") return session.join_opens_at && Date.parse(session.join_opens_at) <= now ? "join_window_open" : "scheduled";
  return "draft";
}
export function liveClassStateLabel(state: LiveClassState) {
  return ({ draft:"Draft",scheduled:"Scheduled",join_window_open:"Join window open",live:"Live now",ended:"Ended",cancelled:"Cancelled" })[state];
}
export function liveClassStateMessage(state: LiveClassState) {
  return ({ draft:"This class is being prepared.",scheduled:"Class is scheduled. The Teacher has not started it.",join_window_open:"The join window is open. Waiting for the Teacher to start; there is no separate waiting room.",live:"Class is now live.",ended:"This class has ended.",cancelled:"This class was cancelled." })[state];
}
