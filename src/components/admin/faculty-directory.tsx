"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { facultyCounts, loadFacultyDirectory, saveFaculty, subjectNames, type FacultyDirectory, type FacultyMember } from "@/lib/faculty-directory";

const field = "min-h-11 w-full rounded border border-[#d8b8c4] bg-white px-3 text-sm";
const empty: FacultyDirectory = { members: [], assignments: [], subjects: [] };
type Draft = { id: string | null; full_name: string; is_active: boolean; subjectIds: string[] };

export function FacultyDirectoryManager() {
  const [directory, setDirectory] = useState(empty), [loading, setLoading] = useState(true), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(""), [subject, setSubject] = useState(""), [status, setStatus] = useState("all"), [login, setLogin] = useState("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const refresh = useCallback(async () => {
    try { setDirectory(await loadFacultyDirectory()); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Faculty directory could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let active = true;
    void loadFacultyDirectory().then(value => { if (active) setDirectory(value); }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Faculty directory could not be loaded."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const counts = useMemo(() => facultyCounts(directory), [directory]);
  const visible = useMemo(() => directory.members.filter(member => {
    const assigned = directory.assignments.filter(a => a.faculty_id === member.id).map(a => a.subject_id);
    return member.full_name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
      && (!subject || assigned.includes(subject))
      && (status === "all" || member.is_active === (status === "active"))
      && (login === "all" || Boolean(member.auth_profile_id) === (login === "linked"));
  }), [directory, search, subject, status, login]);
  const edit = (member?: FacultyMember) => setDraft({ id: member?.id || null, full_name: member?.full_name || "", is_active: member?.is_active ?? true, subjectIds: member ? directory.assignments.filter(a => a.faculty_id === member.id).map(a => a.subject_id) : [] });
  const commit = async (value: Draft) => {
    setBusy(true); setError("");
    try { await saveFaculty(value, value.subjectIds); setDraft(null); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Faculty change could not be saved."); }
    finally { setBusy(false); }
  };
  return <div className="mx-auto max-w-6xl">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-brand">ALS faculty</p><h1 className="mt-2 text-3xl font-bold">Real Faculty Directory</h1><p className="mt-2 text-sm text-muted">Academic faculty can be listed before a Teacher login is assigned.</p></div><button className="min-h-11 rounded bg-brand px-5 text-sm font-bold text-white" onClick={() => edit()}>Add faculty</button></header>
    <div className="mt-4 text-sm text-muted"><strong className="text-deep-blue">{directory.members.length} real faculty</strong><span className="mx-2">·</span>{counts.filter(c=>c.count>0).map(c=>`${c.name}: ${c.count}`).join(" · ")}<span className="mx-2">·</span><Link className="font-semibold text-brand underline" href="/admin/teacher-accounts">Teacher login accounts</Link></div>
    {error && <div role="alert" className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error} <button className="ml-3 underline" onClick={() => void refresh()}>Retry</button></div>}
    <section className="card mt-5 p-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs font-semibold">Search by name<input className={`${field} mt-1`} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Faculty name"/></label><label className="text-xs font-semibold">Subject<select className={`${field} mt-1`} value={subject} onChange={e=>setSubject(e.target.value)}><option value="">All Subjects</option>{directory.subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="text-xs font-semibold">Active status<select className={`${field} mt-1`} value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label><label className="text-xs font-semibold">Login status<select className={`${field} mt-1`} value={login} onChange={e=>setLogin(e.target.value)}><option value="all">All</option><option value="unlinked">No login assigned</option><option value="linked">Login linked</option></select></label></div></section>
    <section className="card mt-4 overflow-hidden" aria-busy={loading}>{loading ? <div role="status" className="p-6">Loading faculty…</div> : <><div className="border-b px-4 py-3 text-xs font-semibold text-muted">Showing {visible.length} of {directory.members.length}</div><div className="divide-y">{visible.map(member=><div key={member.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div className="min-w-0 flex-1"><strong className="block text-sm text-deep-blue">{member.full_name}</strong><p className="mt-1 text-xs text-muted">{subjectNames(member.id,directory).join(" · ") || "No Subject assigned"} <span className="mx-1">·</span> {member.auth_profile_id ? "Login linked" : "No login assigned"}</p></div><span className={`rounded-full px-2 py-1 text-xs font-semibold ${member.is_active?"bg-green-50 text-green-800":"bg-slate-100 text-slate-600"}`}>{member.is_active?"Active":"Inactive"}</span><button className="min-h-10 rounded border px-3 text-sm font-semibold" onClick={() => edit(member)}>Edit</button></div>)}{visible.length===0&&<p className="p-6 text-sm text-muted">No faculty match these filters.</p>}</div></>}</section>
    {draft && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={()=>!busy&&setDraft(null)}><form aria-label={draft.id?"Edit faculty":"Add faculty"} className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl" onClick={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();void commit(draft)}}><h2 className="text-xl font-bold">{draft.id?"Edit faculty":"Add faculty"}</h2><label className="mt-4 block text-sm font-semibold">Full name<input className={`${field} mt-1`} required value={draft.full_name} onChange={e=>setDraft({...draft,full_name:e.target.value})}/></label><fieldset className="mt-4"><legend className="text-sm font-semibold">Subjects</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{directory.subjects.map(s=><label key={s.id} className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={draft.subjectIds.includes(s.id)} onChange={e=>setDraft({...draft,subjectIds:e.target.checked?[...draft.subjectIds,s.id]:draft.subjectIds.filter(id=>id!==s.id)})}/>{s.name}</label>)}</div></fieldset><label className="mt-4 flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={draft.is_active} onChange={e=>setDraft({...draft,is_active:e.target.checked})}/>Active</label><p className="mt-2 text-xs text-muted">A login can be linked later when the faculty member’s real email is supplied.</p><div className="mt-5 flex justify-end gap-2"><button type="button" className="min-h-11 rounded border px-4 text-sm font-bold" disabled={busy} onClick={()=>setDraft(null)}>Cancel</button><button type="submit" className="min-h-11 rounded bg-brand px-4 text-sm font-bold text-white disabled:opacity-50" disabled={busy||!draft.full_name.trim()||draft.subjectIds.length===0}>{busy?"Saving…":"Save faculty"}</button></div></form></div>}
  </div>;
}
