"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Segment = {
  id: string;
  segmentNumber: number;
  mimeType: string;
  durationSeconds: number | null;
  byteLength: number;
  url: string;
  expiresAt: string;
};

export function RecordingPlayback({ classId, recordingId, title, review = false }: { classId: string; recordingId: string; title: string; review?: boolean }) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [active, setActive] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const resumeAtRef = useRef(0);
  const resumePlayingRef = useRef(false);

  const renew = useCallback(async (preservePosition = true) => {
    if (preservePosition && videoRef.current) {
      resumeAtRef.current = Number.isFinite(videoRef.current.currentTime) ? videoRef.current.currentTime : 0;
      resumePlayingRef.current = !videoRef.current.paused && !videoRef.current.ended;
    }
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/live-classes/${classId}/recordings?recordingId=${recordingId}${review ? "&review=1" : ""}`, { cache: "no-store", referrerPolicy: "no-referrer" });
      const value = await response.json() as { segments?: Segment[]; error?: string };
      if (!response.ok || !value.segments?.length) throw new Error(value.error || "No playable lesson segment is available");
      setSegments(value.segments);
      setActive(current => Math.min(current, value.segments!.length - 1));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Recording playback is unavailable");
    } finally { setLoading(false); }
  }, [classId, recordingId, review]);

  useEffect(() => {
    const timer = window.setTimeout(() => void renew(false), 0);
    return () => window.clearTimeout(timer);
  }, [renew]);
  useEffect(() => {
    if (!segments.length) return;
    const expiry = Math.min(...segments.map(segment => Date.parse(segment.expiresAt)));
    const delay = Math.max(30_000, expiry - Date.now() - 90_000);
    const timer = window.setTimeout(() => void renew(), delay);
    return () => window.clearTimeout(timer);
  }, [renew, segments]);

  const segment = segments[active];
  const preparePlayback = (video: HTMLVideoElement) => {
    const resumeAt = resumeAtRef.current;
    resumeAtRef.current = 0;
    const resumePlaying = () => {
      if (!resumePlayingRef.current) return;
      resumePlayingRef.current = false;
      void video.play().catch(() => undefined);
    };
    if (Number.isFinite(video.duration)) {
      if (resumeAt > 0) video.currentTime = Math.min(resumeAt, Math.max(video.duration - 0.01, 0));
      resumePlaying();
      return;
    }
    const finishProbe = () => {
      const duration = video.duration;
      video.currentTime = Number.isFinite(duration)
        ? Math.min(resumeAt, Math.max(duration - 0.01, 0))
        : resumeAt;
      resumePlaying();
    };
    video.addEventListener("seeked", finishProbe, { once: true });
    video.currentTime = 24 * 60 * 60;
  };
  return <div className="mx-auto max-w-5xl">
    {!review && <Link href="/student/live-classes" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-brand"><ChevronLeft size={18}/>Live classes</Link>}
    <div className={`${review ? "" : "mt-4"} flex flex-wrap items-start justify-between gap-3`}><div><p className="eyebrow">{review ? "Admin verification preview" : "Published class recording"}</p><h1 className="mt-2 text-2xl font-bold">{title}</h1><p className="mt-2 text-sm text-muted">{review ? "Play every segment and check decoding, audio, seeking, and intended teaching content before approval." : "Private playback links expire automatically and are renewed while this page remains authorized."}</p></div><Button variant="secondary" onClick={() => void renew()} disabled={loading}><RefreshCw size={17}/>Renew playback</Button></div>
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-900">{error}</p>}
    <section className="card mt-5 overflow-hidden p-0">
      <div className="aspect-video bg-[#101a38]">
        {segment ? <video
          key={`${segment.id}:${segment.url}`}
          ref={videoRef}
          src={segment.url}
          controls
          controlsList="nodownload"
          playsInline
          preload="metadata"
          className="h-full w-full object-contain"
          onLoadedMetadata={event => preparePlayback(event.currentTarget)}
          onEnded={() => { if (active + 1 < segments.length) { setActive(active + 1); resumeAtRef.current = 0; resumePlayingRef.current = false; } }}
          onError={() => void renew()}
        /> : <div className="grid h-full place-items-center p-6 text-center text-sm text-white">{loading ? "Authorizing private playback…" : "Playback unavailable"}</div>}
      </div>
      {segments.length > 1 && <div className="flex flex-wrap gap-2 p-4" aria-label="Recording segments">{segments.map((value, index) => <button key={value.id} onClick={() => { resumeAtRef.current = 0; resumePlayingRef.current = false; setActive(index); }} className={`min-h-11 rounded-lg px-4 text-sm font-bold ${index === active ? "bg-brand text-white" : "border border-line bg-white"}`}>Part {value.segmentNumber}</button>)}</div>}
    </section>
  </div>;
}
