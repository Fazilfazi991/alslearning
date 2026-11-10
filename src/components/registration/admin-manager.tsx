"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { actionStyle, date, request, setupStatus, Status, statusLabels } from "./admin-shared";

type Row = { id: string; full_name: string; email: string; phone: string; status: string; invitation_status?: string | null; created_at: string; programs: { name: string } | null };
type Results = { registrations: Row[]; count: number; page_size: number };

export function RegistrationManager() {
  const [data, setData] = useState<Results | null>(null), [query, setQuery] = useState(""), [status, setStatus] = useState(""), [page, setPage] = useState(1), [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true); setError("");
      void request(`/api/admin/registrations?${new URLSearchParams({ q: query, status, page: String(page) })}`, "GET", undefined, controller.signal)
        .then(setData).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Applications could not be loaded."); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, query ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, status, page, revision]);
  const pages = Math.max(1, Math.ceil((data?.count ?? 0) / (data?.page_size ?? 20)));
  return <>
    <header className="mb-7 flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">Admissions</p><h1 className="mt-2 text-[28px] font-bold tracking-tight">Student registrations</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Review applications, resolve missing details and assign an eligible batch before inviting a student.</p></div><button className={actionStyle} disabled={loading} onClick={() => setRevision(v => v + 1)}>Refresh</button></header>
    <section className="rounded-2xl border border-line bg-white" aria-label="Student applications">
      <div className="grid gap-4 border-b border-line p-5 sm:grid-cols-[minmax(0,1fr)_220px]"><label className="text-sm font-semibold">Search applications<span className="relative block"><Search size={17} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="control pl-10!" type="search" maxLength={120} placeholder="Name, email or phone" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} /></span></label><label className="text-sm font-semibold">Status<select className="control" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{status === "ready_for_approval" && <p className="text-xs leading-5 text-muted sm:col-span-2">Shows complete pending applications with an available approved default batch and no matching student profile. Approval rechecks identity and capacity.</p>}</div>
      {error && <p role="alert" className="m-5 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      <div aria-busy={loading} className="px-5">{loading ? <p role="status" className="py-12 text-center text-sm text-muted">Loading applications…</p> : error ? null : !data?.registrations.length ? <div className="py-14 text-center"><h2 className="text-lg font-bold">No applications found</h2><p className="mt-2 text-sm text-muted">Try another search or status.</p></div> : <><div aria-hidden="true" className="hidden grid-cols-[1.5fr_1fr_1fr_130px_24px] gap-4 border-b border-line py-3 text-xs font-semibold uppercase tracking-wide text-muted lg:grid"><span>Applicant</span><span>Program</span><span>Status</span><span>Received</span><span /></div><div className="divide-y divide-line">{data.registrations.map(row => <Link key={row.id} href={`/admin/registrations/${row.id}`} className="grid gap-2 rounded-lg py-5 hover:bg-surface focus-visible:outline-brand lg:grid-cols-[1.5fr_1fr_1fr_130px_24px] lg:items-center lg:gap-4"><div className="min-w-0"><h2 className="break-words font-bold">{row.full_name}</h2><p className="mt-1 break-all text-sm text-muted">{row.email}</p></div><p className="text-sm font-semibold">{row.programs?.name || "Program unavailable"}</p><div><Status value={status === "ready_for_approval" ? "ready_for_approval" : row.status} />{row.status === "approved" && <p className="mt-1 text-xs text-muted">{setupStatus(row.invitation_status)}</p>}</div><time dateTime={row.created_at} className="text-xs text-muted">{date(row.created_at)}</time><ArrowRight size={18} aria-hidden="true" className="hidden text-brand lg:block" /></Link>)}</div></>}</div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-5"><p className="text-sm text-muted">{data ? `${data.count} matching applications · Page ${page} of ${pages}` : "Applications"}</p><div className="flex gap-2"><button className={actionStyle} disabled={loading || page <= 1} onClick={() => setPage(v => v - 1)}>Previous</button><button className={actionStyle} disabled={loading || page >= pages} onClick={() => setPage(v => v + 1)}>Next</button></div></footer>
    </section>
  </>;
}
