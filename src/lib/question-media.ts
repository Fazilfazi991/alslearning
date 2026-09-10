export type QuestionMedia = {
  id: string;
  kind: "stem" | "solution";
  storage_path: string;
  position: number;
  mime_type: string;
  original_filename: string;
  source?: Record<string, unknown>;
};
export function orderedMedia(
  items: QuestionMedia[],
  kind: QuestionMedia["kind"],
) {
  return items
    .filter((m) => m.kind === kind)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}
export const imageTypes = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];

export function mediaAlt(item: QuestionMedia | undefined, fallback: string) {
  const alt = item?.source?.alt_text;
  const title = item?.source?.title;
  return typeof alt === "string" && alt.trim()
    ? alt
    : typeof title === "string" && title.trim()
      ? title
      : fallback;
}

export function questionLabel(question: { prompt: string }) {
  return question.prompt.trim() || "Image-only question";
}

export function conversionLabel(item: QuestionMedia) {
  const original = item.source?.original;
  return original &&
    typeof original === "object" &&
    "mime_type" in original &&
    original.mime_type === "image/x-emf"
    ? "Source format: EMF · Display format: PNG"
    : null;
}
