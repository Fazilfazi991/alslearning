import { PrivateImage } from "./private-image";
import { orderedMedia, type QuestionMedia } from "@/lib/question-media";
export function QuestionGallery({
  media,
  kind,
  legacy,
}: {
  media?: QuestionMedia[];
  kind: "stem" | "solution";
  legacy?: string | null;
}) {
  if (!media)
    return (
      <PrivateImage
        path={legacy || null}
        alt={kind === "stem" ? "Question image" : "Solution image"}
      />
    );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {orderedMedia(media, kind).map((m, i) => (
        <figure key={m.id}>
          <PrivateImage
            path={m.storage_path}
            alt={`${kind === "stem" ? "Question" : "Solution"} image ${i + 1}`}
          />
          <figcaption className="text-xs text-muted">Image {i + 1}</figcaption>
        </figure>
      ))}
    </div>
  );
}
