"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
export function PrivateImage({
  path,
  alt,
}: {
  path: string | null;
  alt: string;
}) {
  const [state, setState] = useState({ path: "", url: "", error: "" });
  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (path)
        void createClient()
          .storage.from("question-media")
          .createSignedUrl(path, 300)
          .then((r) => {
            if (active)
              setState({
                path,
                url: r.data?.signedUrl || "",
                error: r.error?.message || "",
              });
          });
    };
    refresh();
    const timer = setInterval(refresh, 240000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [path]);
  if (!path) return null;
  if (state.path !== path) return <p>Loading image…</p>;
  return state.error ? (
    <p role="alert">Image unavailable: {state.error}</p>
  ) : state.url ? (
    <a
      href={state.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open full-size ${alt}`}
    >
      <Image
        unoptimized
        src={state.url}
        alt={alt}
        width={900}
        height={600}
        className="my-3 h-auto max-h-96 w-full rounded-lg object-contain"
      />
    </a>
  ) : (
    <p>Loading image…</p>
  );
}
