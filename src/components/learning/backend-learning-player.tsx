"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
type Option = { id: string; content: string };
type Checkpoint = {
  id: string;
  trigger_seconds: number;
  pause_video: boolean;
  mandatory: boolean;
  retry_policy: string;
  show_feedback: boolean;
  questions: {
    prompt: string;
    explanation: string | null;
    question_options: Option[];
  }[];
};
type Data = {
  user: { id: string };
  content: {
    id: string;
    title: string;
    description: string | null;
    kind: string;
    duration_seconds: number | null;
    allow_download: boolean;
    programs: { name: string; slug: string } | null;
  };
  sourceUrl: string | null;
  progress: { position_seconds: number; completed: boolean } | null;
  checkpoints: Checkpoint[];
  siblings: {
    id: string;
    slug: string;
    title: string;
    display_order: number;
  }[];
};
export function BackendLearningPlayer({ data }: { data: Data }) {
  const video = useRef<HTMLVideoElement>(null),
    lastSaved = useRef(data.progress?.position_seconds || 0),
    [active, setActive] = useState<Checkpoint | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [feedback, setFeedback] = useState<string>(""),
    [completed, setCompleted] = useState(Boolean(data.progress?.completed));
  const index = data.siblings.findIndex((x) => x.id === data.content.id),
    previous = data.siblings[index - 1],
    next = data.siblings[index + 1];
  const htmlVideo = useMemo(
    () =>
      Boolean(
        data.sourceUrl && !/youtube\.com|youtu\.be/i.test(data.sourceUrl),
      ),
    [data.sourceUrl],
  );
  const save = useCallback(async (position: number, done = completed) => {
    lastSaved.current = Math.floor(position);
    await createClient()
      .from("video_progress")
      .upsert({
        content_id: data.content.id,
        student_id: data.user.id,
        position_seconds: Math.floor(position),
        completed: done,
        updated_at: new Date().toISOString(),
      });
  }, [completed, data.content.id, data.user.id]);
  function timeUpdate() {
    const element = video.current;
    if (!element) return;
    const now = Math.floor(element.currentTime);
    if (now - lastSaved.current >= 10) void save(now);
    const due = data.checkpoints.find(
      (x) => now >= x.trigger_seconds && lastSaved.current < x.trigger_seconds,
    );
    if (due && !active) {
      if (due.pause_video) element.pause();
      setActive(due);
      setSelected([]);
      setFeedback("");
    }
  }
  useEffect(
    () => () => {
      if (video.current) void save(video.current.currentTime);
    },
    [save],
  );
  async function answer() {
    if (!active || !selected.length) return;
    const { data: correct, error } = await createClient().rpc(
      "submit_checkpoint_response",
      { target_checkpoint: active.id, option_ids: selected },
    );
    if (error) {
      setFeedback(error.message);
      return;
    }
    setFeedback(correct ? "Correct" : "That answer is not correct.");
    if (
      correct ||
      active.retry_policy === "none" ||
      active.retry_policy === "once"
    ) {
      setTimeout(() => {
        setActive(null);
        video.current?.play().catch(() => undefined);
      }, 600);
    }
  }
  async function markComplete() {
    setCompleted(true);
    await save(
      video.current?.currentTime || data.content.duration_seconds || 0,
      true,
    );
  }
  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-surface">
      <header className="sticky top-0 z-40 flex min-h-16 items-center gap-3 border-b bg-white px-4">
        <Link
          href={`/student/courses/${data.content.programs?.slug || ""}`}
          className="flex items-center gap-2 font-bold"
        >
          <ChevronLeft />
          Back
        </Link>
        <p className="mx-auto truncate font-bold">{data.content.title}</p>
      </header>
      <main className="mx-auto max-w-6xl p-4 sm:p-7">
        <section className="overflow-hidden rounded-xl bg-black">
          {htmlVideo ? (
            <video
              ref={video}
              src={data.sourceUrl || undefined}
              controls
              className="aspect-video w-full"
              onLoadedMetadata={(e) => {
                e.currentTarget.currentTime =
                  data.progress?.position_seconds || 0;
              }}
              onTimeUpdate={timeUpdate}
            />
          ) : data.sourceUrl ? (
            <iframe
              className="aspect-video w-full"
              src={data.sourceUrl}
              title={data.content.title}
              allow="autoplay; fullscreen"
            />
          ) : (
            <div className="grid aspect-video place-items-center text-white">
              This media source is unavailable.
            </div>
          )}
        </section>
        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_280px]">
          <article className="card p-6">
            <p className="text-xs font-bold uppercase text-brand">
              {data.content.kind}
            </p>
            <h1 className="mt-2 text-3xl font-bold">{data.content.title}</h1>
            <p className="mt-4 text-muted">
              {data.content.description ||
                "No lesson description has been added."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => void markComplete()}
                className="rounded bg-brand px-4 py-3 font-bold text-white"
              >
                <CheckCircle2 className="mr-2 inline" size={18} />
                {completed ? "Completed" : "Mark complete"}
              </button>
              {data.content.allow_download && data.sourceUrl && (
                <a
                  href={data.sourceUrl}
                  className="rounded border px-4 py-3 font-bold"
                >
                  <Download className="mr-2 inline" size={18} />
                  Download
                </a>
              )}
            </div>
          </article>
          <aside className="card p-5">
            <h2 className="font-bold">Program content</h2>
            {data.siblings.map((x) => (
              <Link
                key={x.id}
                href={`/student/learn/${x.slug}`}
                className={`mt-2 block rounded p-3 text-sm ${x.id === data.content.id ? "bg-brand/10 font-bold text-brand" : "bg-surface"}`}
              >
                {x.title}
              </Link>
            ))}
          </aside>
        </div>
        <nav className="mt-5 flex justify-between">
          {previous ? (
            <Link href={`/student/learn/${previous.slug}`}>
              <ChevronLeft className="inline" /> Previous
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={`/student/learn/${next.slug}`}>
              Next <ChevronRight className="inline" />
            </Link>
          )}
        </nav>
      </main>
      {active && (
        <div className="fixed inset-0 z-60 grid place-items-center bg-black/50 p-4">
          <section
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-xl bg-white p-6"
          >
            <p className="text-xs font-bold uppercase text-brand">
              Video checkpoint
            </p>
            <h2 className="mt-2 text-xl font-bold">
              {active.questions[0]?.prompt}
            </h2>
            <div className="mt-4 space-y-2">
              {active.questions[0]?.question_options.map((option) => (
                <label
                  key={option.id}
                  className="flex gap-3 rounded border p-3"
                >
                  <input
                    type="radio"
                    name="checkpoint"
                    checked={selected.includes(option.id)}
                    onChange={() => setSelected([option.id])}
                  />
                  {option.content}
                </label>
              ))}
            </div>
            {feedback && (
              <p role="status" className="mt-3 text-sm font-bold">
                {feedback}
              </p>
            )}
            <button
              disabled={!selected.length}
              onClick={() => void answer()}
              className="mt-5 rounded bg-brand px-4 py-3 font-bold text-white disabled:opacity-50"
            >
              Submit answer
            </button>
            {!active.mandatory && (
              <button
                onClick={() => setActive(null)}
                className="ml-3 px-4 py-3"
              >
                Skip
              </button>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
