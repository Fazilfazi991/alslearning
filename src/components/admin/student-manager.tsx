"use client";
import Link from "next/link";
import { useCallback,useEffect,useRef,useState } from "react";
import { useRouter } from "next/navigation";
import { admissionErrors,type StudentAdmission } from "@/lib/student-admission";
import { passwordHelp } from "@/lib/account-validation";
import { academicLocalToUtc,utcToAcademicLocalInput } from "@/lib/live-class/date";
export type StudentOptions={programs:{id:string;name:string}[];batches:{id:string;name:string;program_id:string;batch_code:string|null;occupied?:number;capacity?:number|null}[]};
type Student={id:string;full_name:string;email:string;phone:string|null;is_active:boolean;student_code:string|null;admission_on:string|null};
export const studentButton="min-h-11 rounded-lg border border-line px-4 text-sm font-bold disabled:opacity-50";
export class StudentRequestError extends Error {
  constructor(message:string,readonly fields:Record<string,string>={}) {super(message);}
}
export async function studentRequest(url:string,method="GET",body?:unknown) {
  const response=await fetch(url,{method,cache:"no-store",...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
  const value=await response.json();if(!response.ok)throw new StudentRequestError(value.error||"The operation failed.",value.errors??{});return value;
}
export function StudentManager({onChanged}:{onChanged?:()=>void}) {
  const router=useRouter();
  const [students,setStudents]=useState<Student[]>([]),[options,setOptions]=useState<StudentOptions>({programs:[],batches:[]});
  const [query,setQuery]=useState(""),[status,setStatus]=useState("active"),[loading,setLoading]=useState(true),[error,setError]=useState(""),[adding,setAdding]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null);
  const load=useCallback(async()=>{setLoading(true);try{const v=await studentRequest("/api/admin/students");setStudents(v.students);setOptions(v);setError("");}catch(e){setError((e as Error).message);}finally{setLoading(false);}},[]);
  useEffect(()=>{const timer=setTimeout(()=>void load(),0);return()=>clearTimeout(timer);},[load]);
  useEffect(()=>{if(adding)dialog.current?.showModal();else dialog.current?.close();},[adding]);
  const visible=students.filter(s=>`${s.full_name} ${s.email} ${s.student_code??""}`.toLowerCase().includes(query.trim().toLowerCase()) && (status==="all"||s.is_active===(status==="active")));
  return <section className="card mb-6 p-5" aria-label="Student admissions">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-bold">Students</h2><p className="mt-1 text-sm text-muted">View a student’s details, admission and batch history.</p></div><button disabled={loading||!!error} className={`${studentButton} bg-brand text-white`} onClick={()=>setAdding(true)}>Add student</button></header>
    <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_180px]"><label className="text-sm font-semibold">Search students<input className="control" type="search" placeholder="Name, email or Student Code" value={query} onChange={e=>setQuery(e.target.value)}/></label><label className="text-sm font-semibold">Account status<select className="control" value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label></div>
    {error&&<p role="alert" className="mt-4 text-sm text-red-800">{error} <button className="underline" onClick={()=>void load()}>Retry</button></p>}
    <div className="mt-4 divide-y divide-line" aria-busy={loading}>{loading?<p role="status" className="py-6 text-muted">Loading students…</p>:!visible.length?<p className="py-6 text-muted">No students match your search.</p>:visible.map(s=><article key={s.id} className="relative flex flex-wrap items-center gap-4 rounded-lg px-3 py-5 hover:bg-surface focus-within:ring-2 focus-within:ring-brand/30">
      <div className="min-w-0 flex-1"><Link className="font-bold text-ink after:absolute after:inset-0 after:rounded-lg" href={`/admin/students/${s.id}`}><span className="break-words">{s.full_name}</span></Link><p className="mt-1 break-all text-sm text-muted">{s.email}</p><p className="mt-1 text-xs font-semibold text-brand">{s.student_code??"Code pending · admission / backfill review"}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${s.is_active?"bg-green-50 text-green-800":"bg-surface text-muted"}`}>{s.is_active?"Active":"Inactive"}</span><Link className={`relative z-10 inline-flex items-center ${studentButton}`} href={`/admin/students/${s.id}`}>View details</Link>
    </article>)}</div>
    <dialog ref={dialog} onCancel={e=>{e.preventDefault();}} className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-line bg-white p-5 sm:p-7 backdrop:bg-black/40" aria-labelledby="student-admission-title">
      {adding&&<StudentAdmissionForm options={options} onCancel={()=>setAdding(false)} onCreated={id=>{setAdding(false);onChanged?.();router.push(`/admin/students/${id}`);}}/>}
    </dialog>
  </section>;
}
function initialAdmission():StudentAdmission {
  const local=utcToAcademicLocalInput(new Date().toISOString(),"Asia/Dubai");
  return {full_name:"",email:"",password:"",phone:"",admission_on:local.slice(0,10),program_id:"",batch_id:"",access_starts_at:local,access_expires_at:null,unassigned:false,is_active:true,guardian_name:"",guardian_phone:"",guardian_relationship:"",address:"",internal_notes:""};
}
export function StudentAdmissionForm({options,onCancel,onCreated}:{options:StudentOptions;onCancel:()=>void;onCreated:(id:string)=>void}) {
  const [form,setForm]=useState(initialAdmission),[busy,setBusy]=useState(false),[errors,setErrors]=useState<Record<string,string>>({}),[error,setError]=useState(""),[show,setShow]=useState(false);
  const saving=useRef(false);
  const [photo,setPhoto]=useState<File|null>(null),[createdId,setCreatedId]=useState("");
  const change=<K extends keyof StudentAdmission>(key:K,value:StudentAdmission[K])=>setForm(f=>({...f,[key]:value}));
  async function submit(event:React.FormEvent){event.preventDefault();if(saving.current)return;
    const value={...form,access_starts_at:form.access_starts_at?academicLocalToUtc(form.access_starts_at,"Asia/Dubai"):"",access_expires_at:form.access_expires_at?academicLocalToUtc(form.access_expires_at,"Asia/Dubai"):null};
    const issues=createdId?{}:admissionErrors(value);if(photo && (photo.size>2*1024*1024 || !["image/jpeg","image/png","image/webp"].includes(photo.type)))issues.photo="Choose a JPEG, PNG or WebP up to 2 MB.";setErrors(issues);if(Object.keys(issues).length)return;
    saving.current=true;setBusy(true);setError("");
    try{const created=createdId?{id:createdId}:await studentRequest("/api/admin/students","POST",value);setCreatedId(created.id);setForm(f=>({...f,password:""}));if(photo){const file=new FormData();file.set("photo",photo);const response=await fetch(`/api/admin/students/${created.id}/photo`,{method:"POST",body:file});if(!response.ok)throw Error("Student admitted successfully. Photo upload failed; retry the photo or open Student details without recreating the account.");}setForm(initialAdmission());onCreated(created.id);}catch(e){setError((e as Error).message);if(e instanceof StudentRequestError)setErrors(e.fields);}finally{saving.current=false;setBusy(false);}
  }
  function field(key:keyof StudentAdmission,label:string,type="text",required=false,maxLength=120){return <label className="block min-w-0 text-sm font-semibold">{label}<input className="control" type={type} required={required&&!createdId} maxLength={maxLength} value={String(form[key]??"")} disabled={busy} aria-invalid={!!errors[key]} onChange={e=>change(key,e.target.value as never)}/>{errors[key]&&<span className="mt-1 block text-xs text-red-800">{errors[key]}</span>}</label>;}
  const batch=options.batches.find(b=>b.id===form.batch_id);
  return <form onSubmit={submit} className="space-y-7" aria-busy={busy}>
    <header><h2 id="student-admission-title" className="text-2xl font-bold">Add student</h2><p className="mt-2 text-sm text-muted">Create the account and complete admission together. Times use Asia/Dubai.</p></header>
    <fieldset disabled={busy} className="grid gap-5 sm:grid-cols-2"><legend className="mb-4 font-bold">Identity</legend>{field("full_name","Full name","text",true)}{field("email","Email address","email",true,254)}{field("phone","Phone / WhatsApp","tel",false,32)}<label className="text-sm font-semibold">Profile photo (optional)<input className="control" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setPhoto(e.target.files?.[0]??null)}/><span className="mt-2 block text-xs font-normal text-muted">JPEG, PNG or WebP, up to 2 MB. Optional photo upload can be retried independently.</span>{errors.photo&&<span className="mt-1 block text-xs text-red-800">{errors.photo}</span>}</label></fieldset>
    <fieldset disabled={busy} className="grid gap-5 sm:grid-cols-2"><legend className="mb-4 font-bold">Admission and access</legend>{field("admission_on","Admission date","date",true)}<label className="block text-sm font-semibold">Account status<select className="control" value={form.is_active?"active":"inactive"} onChange={e=>change("is_active",e.target.value==="active")}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
    <label className="flex min-h-11 items-center gap-2 text-sm font-semibold sm:col-span-2"><input type="checkbox" checked={form.unassigned} onChange={e=>setForm(f=>({...f,unassigned:e.target.checked,program_id:"",batch_id:""}))}/>Unassigned — create without learning access or Student Code</label>
    {!form.unassigned&&<><label className="text-sm font-semibold">Program<select className="control" required value={form.program_id} onChange={e=>setForm(f=>({...f,program_id:e.target.value,batch_id:""}))}><option value="">Select Program</option>{options.programs.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>{errors.program_id&&<span className="text-xs text-red-800">{errors.program_id}</span>}</label>
    <label className="text-sm font-semibold">Admission batch<select className="control" required disabled={!form.program_id} value={form.batch_id} onChange={e=>change("batch_id",e.target.value)}><option value="">Select Batch</option>{options.batches.filter(b=>b.program_id===form.program_id).map(b=><option key={b.id} value={b.id} disabled={!b.batch_code}>{b.name} · {b.batch_code??"Batch Code required"}</option>)}</select>{errors.batch_id&&<span className="text-xs text-red-800">{errors.batch_id}</span>}</label>
    {batch?.batch_code&&<p className="rounded-lg bg-surface p-3 text-sm sm:col-span-2">Student Code format: <strong>ALS-{batch.batch_code}-001</strong>. The database assigns the next unique sequence; the permanent code stays unchanged after transfer.</p>}
    {field("access_starts_at","Access starts (Dubai)","datetime-local",true)}<div><label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.access_expires_at===null} onChange={e=>change("access_expires_at",e.target.checked?null:"")}/>No expiry</label>{form.access_expires_at!==null&&field("access_expires_at","Access expires (Dubai)","datetime-local",true)}</div></>}
    <label className="text-sm font-semibold sm:col-span-2">Internal notes<textarea className="control" rows={3} maxLength={4000} value={form.internal_notes} onChange={e=>change("internal_notes",e.target.value)}/></label></fieldset>
    <fieldset disabled={busy} className="grid gap-5 sm:grid-cols-2"><legend className="mb-4 font-bold">Guardian and contact</legend>{field("guardian_name","Guardian name")}{field("guardian_phone","Guardian phone","tel",false,32)}{field("guardian_relationship","Relationship","text",false,80)}{field("address","Address","text",false,1000)}</fieldset>
    <fieldset disabled={busy}><legend className="mb-4 font-bold">Authentication</legend>{field("password","Initial password",show?"text":"password",true,128)}<label className="mt-2 flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={show} onChange={e=>setShow(e.target.checked)}/>Show password</label><p className="mt-1 text-xs text-muted">{passwordHelp} Share it privately. It is never displayed after creation.</p></fieldset>
    {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <footer className="flex flex-wrap justify-end gap-3 border-t border-line pt-5">{createdId&&<button type="button" className={studentButton} disabled={busy} onClick={()=>onCreated(createdId)}>Open admitted Student</button>}<button type="button" className={studentButton} disabled={busy} onClick={onCancel}>Cancel</button><button className={`${studentButton} bg-brand text-white`} disabled={busy}>{busy?"Completing admission…":createdId?"Retry photo upload":"Create student"}</button></footer>
  </form>;
}
