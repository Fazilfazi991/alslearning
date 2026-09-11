"use client";
import { useEffect, useRef, useState } from "react";
import { youtubeEmbedUrl } from "@/lib/recorded-classes";

type Player = { destroy(): void };
type YouTubeAPI = { Player: new (element: HTMLElement, options: { events: { onReady(): void; onError(event: { data: number }): void } }) => Player };
declare global { interface Window { YT?: YouTubeAPI; onYouTubeIframeAPIReady?: () => void } }
let apiPromise: Promise<YouTubeAPI> | undefined;
function loadAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) apiPromise = new Promise<YouTubeAPI>((resolve, reject) => {
    const timeout = window.setTimeout(() => { apiPromise = undefined; reject(new Error("Player timed out")); }, 15000);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previous?.(); window.clearTimeout(timeout); if (window.YT) resolve(window.YT); };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => { window.clearTimeout(timeout); apiPromise = undefined; reject(new Error("Player unavailable")); };
    document.head.appendChild(script);
  });
  return apiPromise;
}
export function YouTubePlayer({ videoId, title }: { videoId: string; title: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let player: Player | undefined;
    const node = container.current;
    if (!node) return;
    const iframe = document.createElement("iframe");
    iframe.title = title;
    iframe.src = `${youtubeEmbedUrl(videoId)}?enablejsapi=1&playsinline=1&rel=0&origin=${encodeURIComponent(window.location.origin)}`;
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.className = "absolute inset-0 h-full w-full border-0";
    node.replaceChildren(iframe);
    const timeout = window.setTimeout(() => { if (!cancelled) setState("error"); }, 20000);
    loadAPI().then(api => {
      if (cancelled) return;
      player = new api.Player(iframe, { events: {
        onReady: () => { window.clearTimeout(timeout); if (!cancelled) setState("ready"); },
        onError: () => { window.clearTimeout(timeout); if (!cancelled) setState("error"); },
      } });
    }).catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; window.clearTimeout(timeout); player?.destroy(); node.replaceChildren(); };
  }, [videoId, title, retry]);
  return <section aria-label="Recording player" className="min-w-0">
    <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-950">
      <div ref={container} className="absolute inset-0" />
      {state === "loading" && <p role="status" className="pointer-events-none absolute inset-x-0 top-2 text-center text-sm text-white">Loading video…</p>}
      {state === "error" && <div role="alert" className="absolute inset-0 grid place-content-center gap-2 bg-slate-950 p-4 text-center text-sm text-white"><p>This video is currently unavailable or cannot be embedded.</p><p>Please try again or contact ALS for access.</p><button className="mx-auto min-h-11 rounded border border-white/50 px-4" onClick={() => { setState("loading"); setRetry(x => x+1); }}>Retry player</button></div>}
    </div>
    <p className="mt-2 text-xs text-muted">Playback provided by YouTube. If the video will not play, <a className="underline" href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer">try opening it on YouTube</a> or contact ALS.</p>
  </section>;
}
