"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
export function CoreLearningPlayer({
  data,
}: {
  data: {
    user: { id: string };
    content: {
      id: string;
      title: string;
      kind: string;
      description: string | null;
      allow_download: boolean;
      programs: { name: string; slug: string } | null;
    };
    sourceUrl: string | null;
    progress: { position_seconds: number; completed: boolean } | null;
  };
}) {
  const [error, setError] = useState("");
  const c = data.content,
    url = data.sourceUrl;
  const youtube = () => {
    if (!url) return null;
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, "");
      const id =
        host === "youtu.be"
          ? u.pathname.slice(1)
          : ["youtube.com", "youtube-nocookie.com"].includes(host)
            ? u.searchParams.get("v") || u.pathname.split("/embed/")[1]
            : null;
      return id && /^[\w-]{11}$/.test(id)
        ? `https://www.youtube-nocookie.com/embed/${id}`
        : null;
    } catch {
      return null;
    }
  };
  async function progress(position: number, completed: boolean) {
    const r = await createClient()
      .from("video_progress")
      .upsert({
        content_id: c.id,
        student_id: data.user.id,
        position_seconds: Math.floor(position),
        completed,
        updated_at: new Date().toISOString(),
      });
    if (r.error) setError(r.error.message);
  }
  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <Link
        className="inline-flex min-h-11 items-center font-bold text-brand"
        href={`/student/courses/${c.programs?.slug || ""}`}
      >
        ← Back to program
      </Link>
      <h1 className="my-4 text-2xl font-bold">{c.title}</h1>
      {error && (
        <p role="alert" className="rounded bg-red-50 p-3 text-red-800">
          {error}
        </p>
      )}
      <section className="card overflow-hidden p-4">
        {c.kind === "video" || c.kind === "recording" ? (
          url ? (
            youtube() ? (
              <iframe
                title={c.title}
                src={youtube()!}
                className="aspect-video w-full"
                allow="fullscreen"
              />
            ) : (
              <video
                aria-label={c.title}
                src={url}
                controls
                controlsList={c.allow_download ? "" : "nodownload"}
                className="aspect-video w-full bg-black"
                onLoadedMetadata={(e) => {
                  e.currentTarget.currentTime =
                    data.progress?.position_seconds || 0;
                }}
                onPause={(e) =>
                  void progress(
                    e.currentTarget.currentTime,
                    !!data.progress?.completed,
                  )
                }
                onEnded={(e) =>
                  void progress(e.currentTarget.currentTime, true)
                }
              />
            )
          ) : (
            <p>Video source is unavailable.</p>
          )
        ) : c.kind === "pdf" && url ? (
          <>
            <h2 className="text-lg font-bold">PDF document</h2>
            <p className="mt-2 text-sm text-muted">
              Open this PDF in your browser or a supported document reader.
            </p>
            <a
              className="mt-3 inline-flex min-h-11 items-center font-bold text-brand"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              Open PDF in a new tab
            </a>
          </>
        ) : c.kind === "image" && url ? (
          <Image
            unoptimized
            src={url}
            alt={c.title}
            width={1200}
            height={900}
            className="h-auto max-h-[75dvh] w-full object-contain"
          />
        ) : c.kind === "note" ? (
          <article className="whitespace-pre-wrap leading-7">
            {c.description || "No note text has been added."}
          </article>
        ) : url ? (
          <div>
            <p className="mb-3">
              Open this reference material in its supported viewer.
            </p>
            <a
              className="inline-flex min-h-11 items-center rounded bg-brand px-4 font-bold text-white"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              Open document
            </a>
          </div>
        ) : (
          <p>Material source is unavailable.</p>
        )}
      </section>
      {c.kind !== "note" && c.description && (
        <p className="my-4 whitespace-pre-wrap text-muted">{c.description}</p>
      )}
      {c.allow_download && url && (
        <a
          className="mt-4 inline-flex min-h-11 items-center rounded border px-4 font-semibold"
          href={url}
          download
        >
          Download material
        </a>
      )}
    </div>
  );
}
