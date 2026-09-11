"use client";
import { useState } from "react";
import { PlayCircle } from "lucide-react";
export function RecordingThumbnail({videoId}:{videoId:string}) {
  const [failed,setFailed]=useState(false);
  return <span className="relative grid aspect-video w-24 shrink-0 place-items-center overflow-hidden rounded bg-slate-100 text-muted sm:w-28">
    <PlayCircle size={22} aria-hidden="true"/>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {!failed && <img src={`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`} onError={()=>setFailed(true)} alt="" loading="lazy" width="112" height="63" className="absolute inset-0 h-full w-full object-cover"/>}
  </span>;
}
