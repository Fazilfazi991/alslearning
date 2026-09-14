"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type UploadResult = { storage_key: string; file_size: number; mime_type: "video/mp4"; duration_seconds: number; width: number; height: number };
const inputClass = "mt-1 min-h-11 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm";

async function videoMetadata(file: File) {
  return new Promise<{ duration: number; width: number; height: number }>((resolve, reject) => {
    const element = document.createElement("video"); const url = URL.createObjectURL(file);
    element.preload = "metadata";
    element.onloadedmetadata = () => { const value = { duration: Math.ceil(element.duration), width: element.videoWidth, height: element.videoHeight }; URL.revokeObjectURL(url); resolve(value); };
    element.onerror = () => { URL.revokeObjectURL(url); reject(new Error("The MP4 metadata could not be read.")); };
    element.src = url;
  });
}

export function NativeVideoUploader({ recordingId, onUploaded }: { recordingId: string; onUploaded(value: UploadResult): void }) {
  const [progress, setProgress] = useState(0); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function upload(file: File) {
    setBusy(true); setMessage(""); setProgress(0);
    let session: { uploadId: string; objectKey: string; partSize: number } | null = null;
    try {
      if (file.type !== "video/mp4" && !file.name.toLowerCase().endsWith(".mp4")) throw new Error("Choose an MP4 video.");
      const metadata = await videoMetadata(file);
      const endpoint = `/api/admin/recorded-classes/${recordingId}/upload`;
      const begin = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "begin", fileName: file.name, contentType: "video/mp4", fileSize: file.size }) });
      if (!begin.ok) throw new Error("The secure upload could not be started.");
      session = await begin.json();
      const count = Math.ceil(file.size / session!.partSize); const parts: { partNumber: number; etag: string }[] = [];
      for (let partNumber = 1; partNumber <= count; partNumber++) {
        const signed = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sign", ...session, partNumber }) });
        if (!signed.ok) throw new Error(`Upload part ${partNumber} could not be authorized.`);
        const { url } = await signed.json(); const start = (partNumber - 1) * session!.partSize;
        let response: Response | null = null;
        for (let attempt = 0; attempt < 3 && !response?.ok; attempt++) {
          const controller = new AbortController(); const timeout = window.setTimeout(() => controller.abort(), 3 * 60_000);
          try { response = await fetch(url, { method: "PUT", body: file.slice(start, Math.min(file.size, start + session!.partSize)), signal: controller.signal }); }
          catch { response = null; }
          finally { window.clearTimeout(timeout); }
        }
        if (!response?.ok) throw new Error(`Upload part ${partNumber} failed after retrying.`);
        const etag = response.headers.get("etag"); if (!etag) throw new Error("R2 did not return an upload checksum.");
        parts.push({ partNumber, etag }); setProgress(Math.round(partNumber * 100 / count));
      }
      const completed = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete", ...session, parts }) });
      if (!completed.ok) throw new Error("R2 could not finalize the upload.");
      const result = await completed.json();
      onUploaded({ storage_key: result.objectKey, file_size: file.size, mime_type: "video/mp4", duration_seconds: metadata.duration, width: metadata.width, height: metadata.height });
      setMessage("Upload complete. Save the recording to attach this private video.");
    } catch (error) {
      if (session) await fetch(`/api/admin/recorded-classes/${recordingId}/upload`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "abort", ...session }) }).catch(() => undefined);
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally { setBusy(false); }
  }
  return <div className="rounded-xl border border-line bg-surface p-4"><label className="text-sm font-semibold">Upload private MP4 to R2<input disabled={busy} type="file" accept="video/mp4,.mp4" className="mt-2 block w-full text-sm" onChange={e => { const file=e.target.files?.[0]; if(file) void upload(file); }}/></label>{busy && <div className="mt-3"><progress className="w-full" max={100} value={progress}/><p className="text-xs text-muted">Uploading directly to R2… {progress}%</p></div>}{message && <p role="status" className="mt-2 text-sm">{message}</p>}</div>;
}

type Interaction = { id: string; timestamp_seconds: number; question: string; options: string[]; correct_option: number; explanation: string | null; required_before_continue: boolean; allow_retry: boolean; show_explanation_after_answer: boolean; status: string };
export function RecordedClassInteractionEditor({ recordingId, title }: { recordingId: string; title: string }) {
  const video = useRef<HTMLVideoElement>(null); const [url,setUrl]=useState(""); const [rows,setRows]=useState<Interaction[]>([]); const [notice,setNotice]=useState("");
  const [form,setForm]=useState({timestamp_seconds:0,question:"",options:["",""],correct_option:0,explanation:"",required_before_continue:true,allow_retry:false,show_explanation_after_answer:true,status:"draft"});
  const refresh=useCallback(async()=>{const [playback,interactions]=await Promise.all([fetch(`/api/recorded-classes/${recordingId}/playback`,{cache:"no-store"}),createClient().from("recorded_class_interactions").select("*").eq("recorded_class_id",recordingId).order("timestamp_seconds")]);if(playback.ok)setUrl((await playback.json()).playbackUrl);if(!interactions.error)setRows(interactions.data as Interaction[]);},[recordingId]);
  useEffect(()=>{const timer=window.setTimeout(()=>void refresh(),0);return()=>window.clearTimeout(timer);},[refresh]);
  async function save(){if(!form.question.trim()||form.options.some(option=>!option.trim())){setNotice("Question and options are required.");return;}const value={...form,recorded_class_id:recordingId,question:form.question.trim(),options:form.options.map(x=>x.trim()),explanation:form.explanation.trim()||null};const result=await createClient().from("recorded_class_interactions").insert(value);setNotice(result.error?"Interaction could not be saved.":"Interaction saved.");if(!result.error){setForm(x=>({...x,question:"",explanation:"",options:["",""]}));await refresh();}}
  return <details className="mt-4 rounded-xl border border-line p-4"><summary className="cursor-pointer font-bold">Preview and timestamp interactions</summary>{url&&<video ref={video} className="mt-4 aspect-video w-full max-w-3xl rounded-lg bg-black" src={url} controls playsInline aria-label={`${title} Admin preview`}/>}<button type="button" className="mt-3 min-h-11 rounded-lg border px-4 text-sm font-semibold" onClick={()=>setForm(x=>({...x,timestamp_seconds:Math.floor(video.current?.currentTime??0)}))}>+ Add question here</button><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Time (seconds)<input className={inputClass} type="number" min={0} value={form.timestamp_seconds} onChange={e=>setForm({...form,timestamp_seconds:Number(e.target.value)})}/></label><label className="text-sm font-semibold sm:col-span-2">Question<input className={inputClass} value={form.question} onChange={e=>setForm({...form,question:e.target.value})}/></label>{form.options.map((option,index)=><label key={index} className="text-sm font-semibold">Option {index+1}<input className={inputClass} value={option} onChange={e=>setForm({...form,options:form.options.map((x,i)=>i===index?e.target.value:x)})}/></label>)}<label className="text-sm font-semibold">Correct answer<select className={inputClass} value={form.correct_option} onChange={e=>setForm({...form,correct_option:Number(e.target.value)})}>{form.options.map((_,i)=><option key={i} value={i}>Option {i+1}</option>)}</select></label><label className="text-sm font-semibold sm:col-span-2">Explanation<textarea className={inputClass} value={form.explanation} onChange={e=>setForm({...form,explanation:e.target.value})}/></label><label className="text-sm"><input type="checkbox" checked={form.required_before_continue} onChange={e=>setForm({...form,required_before_continue:e.target.checked})}/> Required before continuing</label><label className="text-sm"><input type="checkbox" checked={form.allow_retry} onChange={e=>setForm({...form,allow_retry:e.target.checked})}/> Allow retry</label><label className="text-sm"><input type="checkbox" checked={form.show_explanation_after_answer} onChange={e=>setForm({...form,show_explanation_after_answer:e.target.checked})}/> Show explanation after response</label><label className="text-sm font-semibold">Status<select className={inputClass} value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="draft">Draft</option><option value="published">Published</option></select></label><button type="button" onClick={()=>void save()} className="min-h-11 rounded-lg bg-brand px-4 font-bold text-white">Save interaction</button></div>{notice&&<p className="mt-2 text-sm">{notice}</p>}<div className="mt-4 space-y-2">{rows.map(row=><p key={row.id} className="rounded-lg bg-surface p-3 text-sm"><strong>{Math.floor(row.timestamp_seconds/60)}:{String(row.timestamp_seconds%60).padStart(2,"0")}</strong> · {row.question} · {row.status}</p>)}</div></details>;
}
