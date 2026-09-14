"use client";
import Link from "next/link";
import {FileCheck2,Clock3} from "lucide-react";
import {useMemo,useState} from "react";
import type {StudentTestSummary} from "@/lib/student-data";

const tabs=["Available","In Progress","Completed","Upcoming"] as const;
type Tab=typeof tabs[number];
const stateForTab:Record<Tab,StudentTestSummary["state"][]>={Available:["available"],"In Progress":["in_progress"],Completed:["completed","closed"],Upcoming:["upcoming"]};
const typeLabel=(type:string)=>type==="mock"||type==="full_exam"?"Mock exam":"Practice test";
export function StudentExamList({tests}:{tests:StudentTestSummary[]}){
 const initial=tests.some(t=>t.state==="in_progress")?"In Progress":"Available";
 const[tab,setTab]=useState<Tab>(initial);const rows=useMemo(()=>tests.filter(t=>stateForTab[tab].includes(t.state)),[tests,tab]);
 return <div className="pb-20 sm:pb-4">
  <div className="-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1" role="tablist" aria-label="Test status">
   {tabs.map(x=><button role="tab" aria-selected={tab===x} key={x} onClick={()=>setTab(x)} className={`min-h-12 shrink-0 border-b-2 px-3 text-sm font-bold ${tab===x?"border-brand text-brand":"border-transparent text-muted"}`}>{x} <span className="font-normal">({tests.filter(t=>stateForTab[x].includes(t.state)).length})</span></button>)}
  </div>
  {rows.length?<div className="mt-4 grid gap-3 lg:grid-cols-2">{rows.map(t=>{
   const cta=t.state==="in_progress"?"Continue":t.state==="completed"||t.state==="closed"?"View result":"View details";
   return <article className="card p-4 sm:p-5" key={t.id}><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand"><FileCheck2 size={20}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold uppercase text-brand">{typeLabel(t.type)}</span><span className="rounded-full bg-surface px-2 py-1 text-[11px] font-semibold text-muted">{t.state.replaceAll("_"," ")}</span></div><h2 className="mt-1 text-base font-bold sm:text-lg">{t.title}</h2><p className="mt-1 truncate text-xs text-muted">{t.subjects?.join(" · ")||"Program assessment"}</p><p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted"><Clock3 size={15}/>{t.question_count} questions · {t.duration_minutes} minutes · {t.max_attempts===null?"Unlimited attempts":`${Math.max(0,t.max_attempts-t.attempts_used)} attempts remaining`}</p></div></div><Link href={`/student/exams/${t.slug}`} className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-brand px-4 text-sm font-bold text-white">{cta}</Link></article>;
  })}</div>:<section className="card mt-4 grid min-h-44 place-items-center p-6 text-center"><div><FileCheck2 className="mx-auto text-muted"/><h2 className="mt-3 font-bold">No {tab.toLowerCase()} tests</h2><p className="mt-1 text-sm text-muted">Tests will appear here when their status changes.</p></div></section>}
 </div>;
}
