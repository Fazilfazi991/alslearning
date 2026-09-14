"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { nextUnansweredInteraction, type RecordedClassInteraction } from "@/lib/recorded-classes";

type ResponseRow = { interaction_id: string; selected_option: number; is_correct: boolean; attempt_number: number };
type Payload = {
  playbackUrl: string; posterUrl: string | null; expiresAt: string;
  interactions: RecordedClassInteraction[]; responses: ResponseRow[];
  progress: { last_position_seconds: number; percentage_completed: number; completed_at: string | null } | null;
};

export function NativeRecordedClassPlayer({ recordingId, title }: { recordingId: string; title: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const previousTime = useRef(0); const lastSaved = useRef(0);
  const seeking = useRef(false);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<RecordedClassInteraction | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ is_correct: boolean; explanation?: string | null } | null>(null);
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const interactions = useMemo(() => payload?.interactions ?? [], [payload]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/recorded-classes/${recordingId}/playback`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const value = await response.json() as Payload;
      setPayload(value); setAnswered(new Set(value.responses.map(item => item.interaction_id)));
      previousTime.current = Number(value.progress?.last_position_seconds ?? 0);
    } catch { setError("This recording could not be authorized or loaded. Please retry."); }
    finally { setLoading(false); }
  }, [recordingId]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => {
    if (!payload) return;
    const delay = Math.max(60_000, new Date(payload.expiresAt).getTime() - Date.now() - 10 * 60_000);
    const timer = window.setTimeout(() => {
      const position = video.current?.currentTime ?? 0; const paused = video.current?.paused ?? true;
      void load().then(() => requestAnimationFrame(() => { if (video.current) { video.current.currentTime = position; if (!paused) void video.current.play(); } }));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [payload, load]);

  async function saveProgress(force = false) {
    const element = video.current; if (!element || !Number.isFinite(element.duration) || element.duration <= 0) return;
    if (!force && Math.abs(element.currentTime - lastSaved.current) < 15) return;
    lastSaved.current = element.currentTime; setSaving(true);
    await createClient().rpc("save_recorded_class_progress", { target: recordingId, position_seconds: element.currentTime, duration_seconds: element.duration });
    setSaving(false);
  }
  function checkCrossing(current: number, requiredOnly = false) {
    const item = nextUnansweredInteraction(interactions, answered, previousTime.current, current, requiredOnly);
    previousTime.current = current;
    if (item && video.current) { video.current.pause(); video.current.currentTime = item.timestamp_seconds; setSelected(null); setFeedback(null); setActive(item); }
  }
  async function answer() {
    if (!active || selected === null) return;
    const result = await createClient().rpc("answer_recorded_class_interaction", { target: active.id, selected });
    if (result.error) { setError("Your response could not be saved. Please try again."); return; }
    setFeedback(result.data as { is_correct: boolean; explanation?: string | null });
    setAnswered(previous => new Set(previous).add(active.id));
    await saveProgress(true);
  }
  function continueClass() { setActive(null); setFeedback(null); if (video.current) { video.current.currentTime = Math.max(video.current.currentTime, (active?.timestamp_seconds ?? 0) + 0.05); void video.current.play(); } }

  return <section aria-label="Recording player" className="min-w-0">
    <div className={`relative overflow-hidden rounded-xl bg-slate-950 ${active ? "sm:aspect-video" : "aspect-video"}`}>
      {payload && <video ref={video} key={payload.playbackUrl} className={`${active ? "hidden sm:block" : "block"} h-full w-full`} controls playsInline preload="metadata" poster={payload.posterUrl ?? undefined}
        src={payload.playbackUrl} aria-label={title}
        onLoadedMetadata={e => { const resume = Number(payload.progress?.last_position_seconds ?? 0); if (resume > 0 && resume < e.currentTarget.duration - 2) e.currentTarget.currentTime = resume; }}
        onTimeUpdate={e => { if (!seeking.current) checkCrossing(e.currentTarget.currentTime); void saveProgress(); }}
        onSeeking={() => { seeking.current = true; }} onSeeked={e => { checkCrossing(e.currentTarget.currentTime, true); seeking.current = false; }} onPause={() => void saveProgress(true)} onEnded={() => void saveProgress(true)}
        onWaiting={() => setLoading(true)} onPlaying={() => setLoading(false)} onError={() => setError("Playback was interrupted. Retry to request a fresh secure link.")}/>} 
      {loading && <p role="status" className="pointer-events-none absolute inset-x-0 top-3 text-center text-sm text-white">Loading video…</p>}
      {error && <div role="alert" className="absolute inset-0 grid place-content-center gap-3 bg-slate-950/95 p-5 text-center text-sm text-white"><p>{error}</p><button className="mx-auto min-h-11 rounded-lg border border-white/60 px-4 font-semibold" onClick={() => void load()}>Retry playback</button></div>}
      {active && <div className="relative bg-slate-950/95 p-4 text-white sm:absolute sm:inset-0 sm:grid sm:place-items-center sm:overflow-y-auto">
        <div className="mx-auto w-full max-w-xl rounded-xl bg-white p-5 text-ink shadow-2xl"><p className="text-xs font-bold uppercase tracking-widest text-brand">Quick Check</p><h2 className="mt-2 text-lg font-bold">{active.question}</h2>
          <div className="mt-4 space-y-2">{active.options.map((option,index) => <label key={index} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 ${selected === index ? "border-brand bg-brand/5" : "border-line"}`}><input type="radio" name={`interaction-${active.id}`} checked={selected === index} disabled={!!feedback} onChange={() => setSelected(index)}/><span>{option}</span></label>)}</div>
          {feedback ? <div className={`mt-4 rounded-lg p-3 text-sm ${feedback.is_correct ? "bg-green-50 text-green-900" : "bg-amber-50 text-amber-950"}`}><strong>{feedback.is_correct ? "Correct" : "Response saved"}</strong>{feedback.explanation && <p className="mt-1">{feedback.explanation}</p>}</div> : null}
          {feedback ? <button className="mt-4 min-h-11 rounded-lg bg-brand px-5 font-bold text-white" onClick={continueClass}>Continue class</button> : <button disabled={selected === null} className="mt-4 min-h-11 rounded-lg bg-brand px-5 font-bold text-white disabled:opacity-50" onClick={() => void answer()}>Submit answer</button>}
        </div>
      </div>}
    </div>
    <div className="mt-2 flex justify-between gap-3 text-xs text-muted"><span>Private ALS playback · secure link refreshes automatically</span><span aria-live="polite">{saving ? "Saving progress…" : payload?.progress?.completed_at ? "Complete" : "Progress saved periodically"}</span></div>
  </section>;
}
