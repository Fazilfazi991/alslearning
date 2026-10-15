"use client";

import {useEffect,useState} from "react";
import {createClient} from "@/lib/supabase/client";
import {RecordingPlayback} from "@/components/live/recording-playback";
import {RecordingReviewQueue} from "./recording-review-queue";
import {RecordedClassesManager} from "./recorded-classes-manager";
import {studentButton} from "./student-manager";

type ClassRow={id:string;title:string;subject_id:string;topic_label:string|null;provider:string;session_id:string|null;duration_seconds:number|null;published_at:string|null};
type Tab="published"|"review"|"uploads";

export function RecordedClassesWorkspace(){
  const [tab,setTab]=useState<Tab>("published");
  const [reviewId,setReviewId]=useState<string|null>(null);
  return <div className="space-y-6">
    <header><h1 className="text-2xl font-bold">Recorded Classes</h1><p className="mt-2 text-sm text-muted">Published lessons, live-class reviews and uploaded classes.</p></header>
    <nav aria-label="Recorded Classes sections" className="flex flex-wrap gap-2">
      {([["published","Published classes"],["review","Recording review"],["uploads","Uploaded classes"]] as const).map(([value,label])=><button key={value} aria-pressed={tab===value} className={`${studentButton} ${tab===value?"bg-brand text-white":"bg-white"}`} onClick={()=>{setTab(value);setReviewId(null);}}>{label}</button>)}
    </nav>
    {tab==="published"&&<PublishedClasses onManage={row=>{setReviewId(row.session_id?row.id:null);setTab(row.session_id?"review":"uploads");}}/>}
    {tab==="review"&&<RecordingReviewQueue recordingId={reviewId}/>}
    {tab==="uploads"&&<RecordedClassesManager/>}
  </div>;
}

function PublishedClasses({onManage}:{onManage:(row:ClassRow)=>void}){
  const [rows,setRows]=useState<ClassRow[]>([]),[subjects,setSubjects]=useState<Record<string,string>>({});
  const [page,setPage]=useState(0),[total,setTotal]=useState(0),[search,setSearch]=useState("");
  const [loading,setLoading]=useState(true),[error,setError]=useState(""),[revision,setRevision]=useState(0),[preview,setPreview]=useState<ClassRow|null>(null);
  useEffect(()=>{
    let cancelled=false;
    const timer=setTimeout(async()=>{
      setLoading(true);setError("");
      try{
        const db=createClient();
        let query=db.from("lms_class_catalog").select("id,title,subject_id,topic_label,provider,session_id,duration_seconds,published_at",{count:"exact"}).eq("status","published").order("published_at",{ascending:false,nullsFirst:false}).order("id").range(page*20,page*20+19);
        if(search.trim())query=query.ilike("title",`%${search.trim().replace(/[%_\\]/g,"\\$&")}%`);
        const [classes,names]=await Promise.all([query,db.from("subjects").select("id,name")]);
        if(classes.error||names.error)throw Error("Published classes could not be loaded. Please retry.");
        if(!cancelled){setRows(classes.data??[]);setTotal(classes.count??0);setSubjects(Object.fromEntries((names.data??[]).map(s=>[s.id,s.name])));}
      }catch(e){if(!cancelled)setError((e as Error).message);}
      finally{if(!cancelled)setLoading(false);}
    },200);
    return()=>{cancelled=true;clearTimeout(timer);};
  },[page,search,revision]);
  return <section className="card p-5 sm:p-6" aria-labelledby="published-classes-title">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="published-classes-title" className="text-xl font-bold">Published classes</h2><p className="mt-2 text-sm text-muted">The same class catalogue used in Student courses. Enrollment and batch eligibility still apply.</p></div><button className={studentButton} disabled={loading} onClick={()=>setRevision(v=>v+1)}>Refresh classes</button></header>
    <label className="mt-5 block max-w-md text-sm font-semibold">Search published classes<input type="search" className="control" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);setPreview(null);}}/></label>
    {error?<p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>:loading?<p role="status" className="mt-5 text-sm">Loading published classes…</p>:!rows.length?<p className="mt-5 rounded-lg bg-surface p-5 text-sm text-muted">{search?"No published classes match this search.":"No published classes yet. Review a completed live recording or publish an uploaded class."}</p>:<div className="mt-4 divide-y divide-line">{rows.map(row=><article key={`${row.provider}:${row.id}`} className="flex flex-wrap items-center justify-between gap-4 py-4"><div className="min-w-0"><h3 className="break-words font-bold">{row.title}</h3><p className="mt-1 text-sm text-muted">{subjects[row.subject_id]??"Subject"} · {row.session_id?"Live class":row.topic_label||"Uploaded class"}{row.duration_seconds?` · ${Math.round(row.duration_seconds)} seconds`:""}</p></div><div className="flex flex-wrap gap-2">{row.session_id&&<button className={studentButton} onClick={()=>setPreview(preview?.id===row.id?null:row)}>Preview class</button>}<button className={studentButton} onClick={()=>onManage(row)}>{row.session_id?"Review / unpublish":"Manage uploaded class"}</button></div></article>)}</div>}
    {preview?.session_id&&<div className="mt-5"><button className={studentButton} onClick={()=>setPreview(null)}>Close class preview</button><RecordingPlayback classId={preview.session_id} recordingId={preview.id} title={preview.title} review/></div>}
    <nav aria-label="Published class pages" className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm"><button className={studentButton} disabled={page===0||loading} onClick={()=>{setPage(p=>p-1);setPreview(null);}}>Previous</button><span>{total} published classes · Page {page+1}</span><button className={studentButton} disabled={(page+1)*20>=total||loading} onClick={()=>{setPage(p=>p+1);setPreview(null);}}>Next</button></nav>
  </section>;
}
