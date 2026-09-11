export type RecordingStatus = "draft" | "published" | "archived";
export type Recording = {
  id: string; subject_id: string; chapter_id: string; topic_label: string | null;
  subtopic: string | null; title: string; description: string | null;
  provider: "youtube"; provider_video_id: string | null; status: RecordingStatus;
  sort_order: number; duration_seconds: number | null; thumbnail_url: string | null;
  teacher_id: string | null; updated_at: string; published_at: string | null;
};
export type RecordingSubject = { id: string; name: string };
export type RecordingTopic = { id: string; name: string; subject_id: string; display_order: number };
export const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;

export function parseYouTubeInput(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  if (videoIdPattern.test(text)) return text;
  let url: URL;
  try { url = new URL(/^[\w.-]+\//.test(text) ? `https://${text}` : text); }
  catch { throw new Error("Enter a valid YouTube URL or 11-character video ID."); }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.port)
    throw new Error("Enter a supported YouTube URL.");
  const host = url.hostname.toLowerCase();
  let id: string | null = null;
  if (host === "youtu.be" && /^\/[^/]+\/?$/.test(url.pathname)) id = url.pathname.split("/")[1];
  if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
    if (url.pathname === "/watch" && url.searchParams.getAll("v").length === 1) id = url.searchParams.get("v");
    else id = url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)\/?$/)?.[1] ?? null;
  }
  if (host === "studio.youtube.com") id = url.pathname.match(/^\/video\/([^/]+)\/edit\/?$/)?.[1] ?? null;
  if (!id || !videoIdPattern.test(id)) throw new Error("Enter a supported YouTube URL with a valid video ID.");
  return id;
}
export function youtubeEmbedUrl(id: string) {
  if (!videoIdPattern.test(id)) throw new Error("Invalid video ID");
  return `https://www.youtube-nocookie.com/embed/${id}`;
}
export function validateRecording(input: { title: string; subject_id: string; chapter_id: string; status: RecordingStatus; videoInput: string; sort_order: number }) {
  if (!input.title.trim() || !input.subject_id || !input.chapter_id) throw new Error("Subject, Topic and video title are required.");
  const id = parseYouTubeInput(input.videoInput);
  if (!id && input.status !== "draft") throw new Error("A recording without a video link must remain Draft.");
  if (!Number.isInteger(input.sort_order) || input.sort_order < 0) throw new Error("Sort order must be a whole number of zero or more.");
  return id;
}
export function topicsForSubject(topics: RecordingTopic[], subjectId: string) {
  return topics.filter(t => t.subject_id === subjectId);
}
export function orderRecordings(rows: Recording[], topics: RecordingTopic[]) {
  const order = new Map(topics.map(t => [t.id, t.display_order]));
  return [...rows].sort((a,b) => (order.get(a.chapter_id) ?? 0) - (order.get(b.chapter_id) ?? 0)
    || a.chapter_id.localeCompare(b.chapter_id) || (a.topic_label ?? "").localeCompare(b.topic_label ?? "")
    || (a.subtopic ?? "").localeCompare(b.subtopic ?? "") || a.sort_order-b.sort_order || a.id.localeCompare(b.id));
}
