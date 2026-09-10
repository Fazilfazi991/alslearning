"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { QuestionGallery } from "@/components/learning/question-gallery";
import { RichContent } from "@/components/learning/rich-text";
import { mediaPositions } from "@/lib/rich-text";
import type { RichText } from "@/lib/rich-text";
import type { QuestionMedia } from "@/lib/question-media";
type Option = { id: string; content: string; content_rich?: RichText };
type Question = {
  id: string;
  prompt: string;
  prompt_rich?: RichText;
  stem_media?: QuestionMedia[];
  type: string;
  stem_image_path: string | null;
  options: Option[];
};
type History = {
  id: string;
  status: string;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
};
type Attempt = {
  id: string;
  status: string;
  expires_at: string;
  option_order: Record<string, string[]>;
  questions: Question[];
  answers: Record<string, string[]>;
};
type Review = {
  status: string;
  results_visible: boolean;
  score: number | null;
  total_marks: number;
  answers: {
    question_id: string;
    prompt: string;
    prompt_rich?: RichText;
    stem_media?: QuestionMedia[];
    options: Option[];
    selected_option_ids: string[];
    correct_option_ids: string[];
    marks_awarded: number;
    explanation: string | null;
    explanation_rich?: RichText;
    solution_media?: QuestionMedia[];
    stem_image_path: string | null;
    explanation_image_path: string | null;
  }[];
};
const button =
  "min-h-11 rounded-lg bg-brand px-4 py-2 font-semibold text-white disabled:opacity-50";
export function CoreTestEngine({
  data,
}: {
  data: {
    test: {
      id: string;
      title: string;
      duration_minutes: number;
      question_count: number;
      max_attempts: number;
      can_start?: boolean;
    };
    attempts: History[];
  };
}) {
  const [history, setHistory] = useState(data.attempts),
    [attempt, setAttempt] = useState<Attempt | null>(null),
    [review, setReview] = useState<Review | null>(null),
    [index, setIndex] = useState(0),
    [remaining, setRemaining] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const expiredSubmission = useRef<string | null>(null);
  const refresh = useCallback(async () => {
    const r = await createClient().rpc("core_attempt_history", {
      target_test: data.test.id,
    });
    if (r.error) throw new Error(r.error.message);
    setHistory(r.data || []);
  }, [data.test.id]);
  const reviewAttempt = useCallback(async (id: string) => {
    const r = await createClient().rpc("get_test_review", {
      target_attempt: id,
    });
    if (r.error) throw new Error(r.error.message);
    setReview(r.data);
    setAttempt(null);
  }, []);
  const open = useCallback(
    async (id: string) => {
      const r = await createClient().rpc("core_attempt_payload", {
        target_attempt: id,
      });
      if (r.error) throw new Error(r.error.message);
      if (r.data.status !== "in_progress") {
        await reviewAttempt(id);
        await refresh();
      } else {
        setAttempt(r.data);
        setReview(null);
        setIndex(0);
      }
    },
    [reviewAttempt, refresh],
  );
  useEffect(() => {
    const current = data.attempts.find((a) => a.status === "in_progress");
    if (current)
      void Promise.resolve(
        createClient().rpc("core_attempt_payload", {
          target_attempt: current.id,
        }),
      )
        .then(async (r) => {
          if (r.error) throw new Error(r.error.message);
          if (r.data.status === "in_progress") setAttempt(r.data);
          else {
            await reviewAttempt(current.id);
            await refresh();
          }
        })
        .catch((e) => setError(e.message));
  }, [data.attempts, reviewAttempt, refresh]);
  const submit = useCallback(
    async (id: string) => {
      if (submitting.current) return;
      submitting.current = true;
      setBusy(true);
      setError("");
      try {
        const r = await createClient().rpc("submit_test_attempt", {
          target_attempt: id,
        });
        if (r.error) throw new Error(r.error.message);
        await reviewAttempt(id);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Submission failed");
      } finally {
        submitting.current = false;
        setBusy(false);
      }
    },
    [reviewAttempt, refresh],
  );
  useEffect(() => {
    if (!attempt) return;
    const tick = () => {
      const left = Math.max(
        0,
        Math.ceil((new Date(attempt.expires_at).getTime() - Date.now()) / 1000),
      );
      setRemaining(left);
      if (
        left === 0 &&
        !submitting.current &&
        expiredSubmission.current !== attempt.id
      ) {
        expiredSubmission.current = attempt.id;
        void submit(attempt.id);
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [attempt, submit]);
  async function start() {
    setBusy(true);
    setError("");
    try {
      const r = await createClient().rpc("start_test_attempt", {
        target_test: data.test.id,
      });
      if (r.error) throw new Error(r.error.message);
      await open(r.data.id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cannot start");
    } finally {
      setBusy(false);
    }
  }
  async function answer(q: Question, id: string) {
    if (!attempt || busy) return;
    setBusy(true);
    setError("");
    const prior = attempt.answers[q.id] || [];
    const selected =
      q.type === "multiple_mcq"
        ? prior.includes(id)
          ? prior.filter((x) => x !== id)
          : [...prior, id]
        : [id];
    const r = await createClient().rpc("save_attempt_answer", {
      target_attempt: attempt.id,
      target_question: q.id,
      option_ids: selected,
    });
    if (r.error) setError(r.error.message);
    else
      setAttempt({
        ...attempt,
        answers: { ...attempt.answers, [q.id]: selected },
      });
    setBusy(false);
  }
  const q = attempt?.questions[index];
  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <h1 className="mb-4 text-2xl font-bold">{data.test.title}</h1>
      {error && (
        <p role="alert" className="my-3 rounded bg-red-50 p-3 text-red-800">
          {error}
        </p>
      )}
      {attempt && q ? (
        <section className="card p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap justify-between gap-3">
            <span>
              Question {index + 1} of {attempt.questions.length}
            </span>
            <strong role="timer">
              {Math.floor(remaining / 60)}:
              {String(remaining % 60).padStart(2, "0")}
            </strong>
          </div>
          <div className="min-w-0 whitespace-pre-wrap text-lg font-bold">
            <RichContent
              value={q.prompt_rich}
              fallback={q.prompt}
              media={q.stem_media}
              kind="stem"
            />
          </div>
          <QuestionGallery
            kind="stem"
            media={mediaPositions(q.prompt_rich).length ? [] : q.stem_media}
            legacy={q.stem_image_path}
          />
          <fieldset className="my-5 space-y-3">
            <legend className="mb-2 text-sm">
              {q.type === "multiple_mcq"
                ? "Select all correct answers"
                : "Select one answer"}
            </legend>
            {[...q.options]
              .sort(
                (a, b) =>
                  (attempt.option_order[q.id] || []).indexOf(a.id) -
                  (attempt.option_order[q.id] || []).indexOf(b.id),
              )
              .map((o) => (
                <label
                  key={o.id}
                  className="flex min-h-12 items-start gap-3 rounded-lg border p-3"
                >
                  <input
                    disabled={busy || remaining === 0}
                    type={q.type === "multiple_mcq" ? "checkbox" : "radio"}
                    name="answer"
                    checked={(attempt.answers[q.id] || []).includes(o.id)}
                    onChange={() => void answer(q, o.id)}
                  />
                  <RichContent value={o.content_rich} fallback={o.content} />
                </label>
              ))}
          </fieldset>
          <div className="flex flex-wrap justify-between gap-3">
            <button
              disabled={busy || index === 0}
              className={button}
              onClick={() => setIndex((i) => i - 1)}
            >
              Previous
            </button>
            {index < attempt.questions.length - 1 && (
              <button
                disabled={busy}
                className={button}
                onClick={() => setIndex((i) => i + 1)}
              >
                Next
              </button>
            )}
            <button
              disabled={busy}
              className={button}
              onClick={() => void submit(attempt.id)}
            >
              {busy ? "Saving…" : "Submit test"}
            </button>
          </div>
        </section>
      ) : (
        <>
          {review && (
            <section className="card mb-5 p-4 sm:p-6">
              <h2 className="text-xl font-bold">Submitted result</h2>
              <p className="mt-2 font-semibold">
                {review.results_visible
                  ? `Score: ${review.score} / ${review.total_marks}`
                  : "Your submission is saved. Results are hidden by the test settings."}
              </p>
              {review.answers?.map((a) => (
                <article className="mt-5 border-t pt-4" key={a.question_id}>
                  <div className="min-w-0 font-bold">
                    <RichContent
                      value={a.prompt_rich}
                      fallback={a.prompt}
                      media={a.stem_media}
                      kind="stem"
                    />
                  </div>
                  <QuestionGallery
                    kind="stem"
                    media={
                      mediaPositions(a.prompt_rich).length ? [] : a.stem_media
                    }
                    legacy={a.stem_image_path}
                  />
                  <div className="mt-2 text-sm">
                    Your answer:{" "}
                    {a.options
                      .filter((o) => a.selected_option_ids.includes(o.id))
                      .map((o) => (
                        <div key={o.id} className="mr-2">
                          <RichContent
                            value={o.content_rich}
                            fallback={o.content}
                          />
                        </div>
                      ))}
                    {a.selected_option_ids.length === 0 && "Unanswered"}
                  </div>
                  <div className="text-sm">
                    Correct answer:{" "}
                    {a.options
                      .filter((o) => a.correct_option_ids.includes(o.id))
                      .map((o) => (
                        <div key={o.id} className="mr-2">
                          <RichContent
                            value={o.content_rich}
                            fallback={o.content}
                          />
                        </div>
                      ))}
                  </div>
                  <p className="text-sm">Marks earned: {a.marks_awarded}</p>
                  {(a.explanation || a.explanation_rich) && (
                    <div className="mt-2 whitespace-pre-wrap">
                      <RichContent
                        value={a.explanation_rich}
                        fallback={a.explanation}
                        media={a.solution_media}
                        kind="solution"
                      />
                    </div>
                  )}
                  <QuestionGallery
                    kind="solution"
                    media={
                      mediaPositions(a.explanation_rich).length
                        ? []
                        : a.solution_media
                    }
                    legacy={a.explanation_image_path}
                  />
                </article>
              ))}
            </section>
          )}
          <section className="card p-4">
            <p>
              {data.test.question_count} questions ·{" "}
              {data.test.duration_minutes} minutes · {data.test.max_attempts}{" "}
              attempts allowed
            </p>
            <button
              disabled={
                busy ||
                data.test.can_start === false ||
                history.length >= data.test.max_attempts
              }
              className={`${button} mt-4`}
              onClick={() => void start()}
            >
              Start attempt
            </button>
            {history.length >= data.test.max_attempts && (
              <p className="mt-2 text-sm">Attempt limit reached.</p>
            )}
          </section>
          <section className="card mt-5 p-4">
            <h2 className="text-lg font-bold">Attempt history</h2>
            {!history.length && (
              <p className="mt-2 text-sm text-muted">No attempts yet.</p>
            )}
            {history.map((a, i) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3 border-b py-3"
                key={a.id}
              >
                <div>
                  <p>
                    Attempt {history.length - i} ·{" "}
                    {a.status.replaceAll("_", " ")}
                  </p>
                  <p className="text-sm text-muted">
                    {new Date(a.started_at).toLocaleString()}
                    {a.score !== null ? ` · Score ${a.score}` : ""}
                  </p>
                </div>
                <button
                  className="min-h-11 rounded border px-3"
                  onClick={() =>
                    void (
                      a.status === "in_progress"
                        ? open(a.id)
                        : reviewAttempt(a.id)
                    ).catch((e) => setError(e.message))
                  }
                >
                  {a.status === "in_progress" ? "Resume" : "View result"}
                </button>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
