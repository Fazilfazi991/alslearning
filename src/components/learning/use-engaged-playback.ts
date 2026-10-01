"use client";
import { useEffect, useRef, type RefObject } from "react";
import { createClient } from "@/lib/supabase/client";

export function engagedPlaybackDelta(previous: number, current: number, wallSeconds: number, active: boolean, rate: number) {
  const advance = current - previous;
  if (!active || wallSeconds <= 0 || wallSeconds > 2.5 || advance <= 0 || advance > wallSeconds * Math.max(rate, 1) + 0.5) return 0;
  return Math.min(wallSeconds, advance / Math.max(rate, 0.1));
}

/** Native playback only. Resume position and completion remain separate. */
export function useEngagedPlayback(video: RefObject<HTMLVideoElement | null>, contentKind: "lesson" | "recorded_class", contentId: string) {
  const pending = useRef<{ event_id: string; content_kind: string; content_id: string; started_at: string; ended_at: string; elapsed_seconds: number }[]>([]);
  useEffect(() => {
    let previous = video.current?.currentTime ?? 0;
    let lastTick = performance.now();
    let previousActive = false;
    let boundElement: HTMLVideoElement | null = null;
    let start = Date.now(); let elapsed = 0; let sending = false;
    async function flush() {
      const end = Date.now();
      if (elapsed > 0 && end - start <= 30_000) pending.current.push({ event_id: crypto.randomUUID(), content_kind: contentKind, content_id: contentId, started_at: new Date(start).toISOString(), ended_at: new Date(end).toISOString(), elapsed_seconds: Math.min(elapsed, 30) });
      elapsed = 0; start = end;
      if (sending) return;
      sending = true;
      try {
        while (pending.current.length) {
          const next = pending.current[0];
          if (Date.now() - Date.parse(next.started_at) > 290_000) { pending.current.shift(); continue; }
          const result = await createClient().rpc("record_playback_watch_interval", next);
          if (result.error) break; // Retain identical event identity for a later retry.
          pending.current.shift();
        }
      } finally { sending = false; }
    }
    const timer = window.setInterval(() => {
      const now = performance.now(); const element = video.current;
      if (element) {
        if (element !== boundElement) {
          boundElement?.removeEventListener("seeking", resetSample);
          boundElement?.removeEventListener("seeked", resetSample);
          boundElement?.removeEventListener("pause", stop);
          boundElement?.removeEventListener("ended", stop);
          boundElement = element;
          element.addEventListener("seeking", resetSample); element.addEventListener("seeked", resetSample);
          element.addEventListener("pause", stop); element.addEventListener("ended", stop);
        }
        const active = document.visibilityState === "visible" && document.hasFocus() && !element.paused && !element.ended && !element.seeking && element.readyState >= 3;
        elapsed += engagedPlaybackDelta(previous, element.currentTime, (now-lastTick)/1000,
          active && previousActive,
          element.playbackRate);
        previous = element.currentTime;
        previousActive = active;
      }
      lastTick = now;
      if (Date.now() - start >= 15_000) void flush();
    }, 1000);
    function resetSample() { lastTick = performance.now(); previous = video.current?.currentTime ?? 0; previousActive = false; }
    const stop = () => { resetSample(); void flush(); };
    document.addEventListener("visibilitychange", stop); window.addEventListener("blur", stop); window.addEventListener("pagehide", stop);
    return () => { window.clearInterval(timer); boundElement?.removeEventListener("seeking", resetSample); boundElement?.removeEventListener("seeked", resetSample); boundElement?.removeEventListener("pause", stop); boundElement?.removeEventListener("ended", stop); document.removeEventListener("visibilitychange", stop); window.removeEventListener("blur", stop); window.removeEventListener("pagehide", stop); void flush(); };
  }, [video, contentKind, contentId]);
}
