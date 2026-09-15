"use client";
import {Suspense,useEffect,useMemo,useState} from "react";
import {useSearchParams} from "next/navigation";
import dynamic from "next/dynamic";
import {useAuthorIdentity} from "./author-identity";
import {Editor,Field,Select,fieldClass,actionClass} from "./core-fields";
import {canManage,newQuestion,saveCoreQuestion,type CoreData,type Question} from "@/lib/core-repository";
import {QuestionPreview} from "./test-question-picker";
import {teacherQuestionAction} from "@/lib/teacher-question-action";
import {QUESTION_PAGE_SIZE,scheduleQuestionSearch,readQuestionFilters,questionFilterParams,changeQuestionFilter,questionExcerpt,type QuestionFilters} from "@/lib/question-bank";
import {countQuestions,loadQuestionBankMetadata,loadQuestionPage,loadQuestionDetail,type QuestionRow} from "@/lib/question-bank-repository";
const QuestionForm=dynamic(()=>import("./core-manager").then(m=>m.QuestionForm),{loading:()=> <p role="status">Loading question editor…</p>});
type Result<T>={key:string;data?:T;error?:string};
const emptyHierarchy={subjects:[],chapters:[]};
const retryClass="min-h-11 rounded-lg border px-3 text-sm font-semibold disabled:opacity-50";
export function QuestionBank(){return <Suspense fallback={<p role="status">Loading question filters…</p>}><QuestionBankContent/></Suspense>;}
function QuestionBankContent(){
  const actor=useAuthorIdentity();
  const params=useSearchParams();const queryString=params.toString();
  const filters=useMemo(()=>readQuestionFilters(new URLSearchParams(queryString)),[queryString]);
  const [draft,setDraft]=useState<{key:string;value:string}|null>(null);
  const search=draft?.key===queryString?draft.value:filters.search;
  const [metadata,setMetadata]=useState<Result<CoreData>|null>(null);
  const [rows,setRows]=useState<Result<QuestionRow[]>|null>(null);
  const [count,setCount]=useState<Result<number>|null>(null);
  const [revision,setRevision]=useState(0),[metadataRevision,setMetadataRevision]=useState(0);
  const [detail,setDetail]=useState<{id:string;value?:Question;error?:string}|null>(null);
  const [busy,setBusy]=useState(false),[saveError,setSaveError]=useState(""),[notice,setNotice]=useState("");
  const identity=actor&&["admin","teacher"].includes(actor.role)?actor:undefined;
  const metadataKey=`${identity?.id}:${metadataRevision}`;
  const academic=metadata?.key===metadataKey?metadata.data:undefined;
  const hierarchy=academic||emptyHierarchy;
  const ready=!!identity&&(!filters.search.trim()||!!academic);
  const listKey=JSON.stringify([identity?.id,filters,revision]);
  const countKey=JSON.stringify([identity?.id,{...filters,page:0},revision]);
  const list=rows?.key===listKey?rows:undefined;
  const total=count?.key===countKey?count:undefined;
  const metadataError=metadata?.key===metadataKey?metadata.error:undefined;
  function navigate(next:QuestionFilters,replace=false){const value=questionFilterParams(next).toString();const url=`${window.location.pathname}${value?`?${value}`:""}`;if(replace)window.history.replaceState(null,"",url);else window.history.pushState(null,"",url);}
  function change<K extends keyof QuestionFilters>(key:K,value:QuestionFilters[K]){setDraft(null);navigate(changeQuestionFilter({...filters,search},key,value));}
  useEffect(()=>{
    if(!draft||draft.key!==queryString||draft.value===filters.search)return;
    return scheduleQuestionSearch(()=>navigate(changeQuestionFilter(filters,"search",draft.value),true));
  },[draft,queryString,filters]);
  useEffect(()=>{
    if(!identity)return;let cancelled=false;
    void loadQuestionBankMetadata(identity).then(data=>{if(!cancelled)setMetadata({key:metadataKey,data});}).catch(()=>{if(!cancelled)setMetadata({key:metadataKey,error:"Could not load academic filters. Please retry."});});
    return()=>{cancelled=true;};
  },[identity,metadataKey]);
  useEffect(()=>{
    if(!identity||!ready)return;
    const controller=new AbortController();
    void loadQuestionPage(identity,filters,hierarchy,controller.signal).then(data=>{if(!controller.signal.aborted)setRows({key:listKey,data});}).catch(()=>{if(!controller.signal.aborted)setRows({key:listKey,error:"Could not load questions. Check your connection and retry."});});
    return()=>controller.abort();
    // The request key captures all filters; hierarchy is only required for search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[listKey,ready]);
  useEffect(()=>{
    if(!identity||!ready)return;
    const controller=new AbortController();
    void countQuestions(identity,filters,hierarchy,controller.signal).then(data=>{if(!controller.signal.aborted)setCount({key:countKey,data});}).catch(()=>{if(!controller.signal.aborted)setCount({key:countKey,error:"Could not load the result count. Please retry."});});
    return()=>controller.abort();
    // Page navigation reuses this filter's exact count, not a downloaded bank.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[countKey,ready]);
  async function open(id:string){if(!identity)return;setSaveError("");setDetail({id});try{const value=await loadQuestionDetail(identity,id);setDetail(current=>current?.id===id?{id,value}:current);}catch{setDetail(current=>current?.id===id?{id,error:"Could not open this question. Please retry."}:current);}}
  async function save(value:Question){if(!academic||!canManage(academic,"questions",value)){setSaveError("This question is available for viewing only.");return;}setBusy(true);setSaveError("");try{await saveCoreQuestion(value);setDetail(null);setRevision(v=>v+1);setNotice("Question saved.");}catch{setSaveError("Could not save the question. Check the fields, connection and your assigned authoring scope, then retry.");}finally{setBusy(false);}}
  if(!identity)return <p role="alert">Author access required. Sign in again to continue.</p>;
  return <div className="min-w-0">
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Question Bank</h1><p className="mt-1 text-sm text-muted">Browse assigned questions and drafts.</p></div><button className={actionClass} disabled={!academic||!canManage(academic,"questions")} onClick={()=>{setSaveError("");const value=newQuestion();setDetail({id:value.id,value});}}>Add question</button></header>
    {notice&&<p role="status" className="mb-3 text-green-800">{notice}</p>}
    <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Search questions"><input className={fieldClass} type="search" value={search} onChange={e=>setDraft({key:queryString,value:e.target.value})} placeholder="Stem, source, subject or section"/></Field>
      <Select label="Filter by subject" emptyLabel="All subjects" value={filters.subject} items={academic?.subjects||[]} disabled={!academic} onChange={v=>change("subject",v)}/>
      <Select label="Filter by chapter" emptyLabel="All sections" value={filters.section} items={academic?.chapters.filter(c=>!filters.subject||c.subject_id===filters.subject)||[]} disabled={!academic} onChange={v=>change("section",v)}/>
      <Select label="Filter by status" emptyLabel="All statuses" value={filters.status} items={[{id:"active",name:"Active"},{id:"draft",name:"Draft / Review"},{id:"archived",name:"Archived"}]} onChange={v=>change("status",v)}/>
      <Select label="Filter by source" emptyLabel="All sources" value={filters.source} items={[{id:"standard",name:"Regular"},{id:"previous_exam",name:"Previous paper"},{id:"recalled",name:"Recalled"}]} onChange={v=>change("source",v)}/>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={filters.review} onChange={e=>change("review",e.target.checked)}/>Content review required only</label>
    </div>
    {!academic&&(metadataError?<div role="alert" className="mb-3">{metadataError} <button className={retryClass} onClick={()=>setMetadataRevision(v=>v+1)}>Retry filters</button></div>:<p role="status" className="mb-3 text-sm">Loading academic filters…</p>)}
    <section aria-label="Question results" aria-busy={!list} className="min-w-0">
      {!list?<p role="status" className="card p-4">Loading questions…</p>:list.error?<div role="alert" className="card p-4">{list.error} <button className={retryClass} onClick={()=>setRevision(v=>v+1)}>Retry questions</button></div>:!list.data?.length?<p role="status" className="card p-4">No matching questions. Change the filters{filters.page?" or return to the first page":""}.{filters.page>0&&<button className={retryClass} onClick={()=>change("page",0)}>First page</button>}</p>:<div className="divide-y rounded-lg border border-line bg-white">{list.data.map(q=><article className="flex min-w-0 flex-wrap items-start gap-3 p-3 sm:p-4" key={q.id}><div className="min-w-0 flex-1 basis-48"><p className="text-xs font-bold uppercase text-brand">{q.status}{q.source_label?.includes("CONTENT REVIEW REQUIRED")?" · Content review required":""}</p><h2 className="mt-1 line-clamp-3 break-words text-sm font-semibold [overflow-wrap:anywhere]">{questionExcerpt(q.prompt)}</h2><p className="mt-1 break-words text-xs text-muted">{academic?.subjects.find(s=>s.id===q.subject_id)?.name} · {academic?.chapters.find(c=>c.id===q.chapter_id)?.name}</p><p className="mt-1 text-xs text-muted">{q.type.replaceAll("_"," ")} · {q.marks} marks</p>{!q.prompt?.trim()&&<p className="mt-1 line-clamp-2 break-all text-xs text-muted">{q.source_label||q.source_reference}</p>}</div><button className={`${retryClass} shrink-0`} disabled={!academic} onClick={()=>void open(q.id)}>{academic?teacherQuestionAction(academic,q):"View question"}</button></article>)}</div>}
    </section>
    <nav aria-label="Question pages" className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <button className={retryClass} disabled={!filters.page||!list||!!list.error} onClick={()=>change("page",filters.page-1)}>Previous</button>
      <div className="text-center text-sm" aria-live="polite"><p>Page {filters.page+1}{total?.data!==undefined?` of ${Math.max(1,Math.ceil(total.data/QUESTION_PAGE_SIZE))}`:""}</p>{total?.data!==undefined?<p>{list?.data?.length?`Showing ${filters.page*QUESTION_PAGE_SIZE+1}–${filters.page*QUESTION_PAGE_SIZE+list.data.length} of ${total.data}`:`${total.data} matching questions`}</p>:total?.error?<p role="alert">{total.error} <button className={retryClass} onClick={()=>setRevision(v=>v+1)}>Retry count</button></p>:<p role="status">Counting results…</p>}</div>
      <button className={retryClass} disabled={!list?.data?.length||!!list.error||(total?.data!==undefined?(filters.page+1)*QUESTION_PAGE_SIZE>=total.data:list.data.length<QUESTION_PAGE_SIZE)} onClick={()=>change("page",filters.page+1)}>Next</button>
    </nav>
    {detail&&<Editor title={detail.value&&academic?teacherQuestionAction(academic,detail.value):"Question details"} close={()=>{if(!busy)setDetail(null);}}>{saveError&&<p role="alert" className="mb-3 text-red-800">{saveError}</p>}{detail.error?<div role="alert">{detail.error} <button className={retryClass} onClick={()=>void open(detail.id)}>Retry question</button></div>:detail.value&&academic?(canManage(academic,"questions",detail.value)?<QuestionForm key={detail.id} value={detail.value} data={academic} busy={busy} save={save}/>:<div className="space-y-3"><p className="text-sm text-muted">Read-only canonical question · {detail.value.status} · {detail.value.marks} marks</p><QuestionPreview question={detail.value}/><p className="break-words text-xs text-muted">{detail.value.source_label||detail.value.source_reference}</p></div>):<p role="status">Loading question details…</p>}</Editor>}
  </div>;
}
