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
