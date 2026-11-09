"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, RefreshCw, Search } from "lucide-react";
import { EnquiryAction, EnquiryStatusBadge, enquiryDate, enquiryRequest, enquiryStatuses, statusLabels, type Enquiry, type EnquiryStatus } from "./enquiries-shared";

type Register = {
  enquiries: Enquiry[]; count: number; page: number; page_size: number;
  stats: { total: number; new: number; interested: number; follow_up: number; converted: number };
  programs: { id: string; name: string }[];
};
const metricLabels = { total: "Total enquiries", new: "New enquiries", interested: "Interested students", follow_up: "Follow-ups pending", converted: "Converted students" } as const;

export function EnquiriesManager({ initialStatus = "", initialPending = false }: { initialStatus?: string; initialPending?: boolean }) {
  const [data, setData] = useState<Register | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [query, setQuery] = useState(""), [status, setStatus] = useState(initialStatus), [program, setProgram] = useState("");
  const [pending, setPending] = useState(initialPending);
  const [from, setFrom] = useState(""), [to, setTo] = useState(""), [sort, setSort] = useState("newest"), [page, setPage] = useState(1), [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true); setError("");
      const params = new URLSearchParams({ q: query, status, program_id: program, from, to, sort, page: String(page), pending: String(pending) });
      void enquiryRequest(`/api/admin/enquiries?${params}`, "GET", undefined, controller.signal)
        .then(setData).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Enquiries could not be loaded."); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, query ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, status, program, from, to, sort, page, revision, pending]);
  function changeFilter(setter: (value: string) => void, value: string) { setter(value); setPage(1); }
  const pages = Math.max(1, Math.ceil((data?.count ?? 0) / (data?.page_size ?? 20)));
  return <>
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div><p className="eyebrow">Admissions</p><h1 className="mt-2 text-[28px] font-bold tracking-tight">Enquiries</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Follow each conversation from first interest to a place in an ALS batch.</p></div>
      <EnquiryAction onClick={() => setRevision(value => value + 1)} disabled={loading}><RefreshCw size={16} aria-hidden="true" />Refresh</EnquiryAction>
    </header>
    <section aria-label="Enquiry metrics" className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-5">
      {Object.entries(metricLabels).map(([key, label]) => <button key={key} type="button" className={`rounded-xl border border-line bg-white p-4 text-left hover:border-brand/40 focus-visible:outline-brand ${(key === "follow_up" ? pending : status === key) ? "ring-2 ring-brand/20" : ""}`} onClick={() => { setPending(key === "follow_up"); changeFilter(setStatus, key === "total" || key === "follow_up" ? "" : key); }}>
        <span className="block text-xs font-semibold text-muted">{label}</span><span className="mt-3 block text-3xl font-bold tabular-nums text-ink">{data ? data.stats[key as keyof Register["stats"]] : "—"}</span>
      </button>)}
    </section>
    <section className="rounded-2xl border border-line bg-white" aria-label="Enquiry register">
      <form className="grid gap-4 border-b border-line p-5 sm:grid-cols-2 xl:grid-cols-6" onSubmit={event => event.preventDefault()} aria-label="Filter enquiries">
        <label className="text-sm font-semibold sm:col-span-2">Search enquiries<span className="relative block"><Search size={17} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input type="search" maxLength={120} className="control pl-10!" placeholder="Name, phone or email" value={query} onChange={event => changeFilter(setQuery, event.target.value)} /></span></label>
        <label className="text-sm font-semibold">Status<select className="control" value={status} onChange={event => changeFilter(setStatus, event.target.value)}><option value="">All statuses</option>{enquiryStatuses.map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></label>
        <label className="text-sm font-semibold">Interested course<select className="control" value={program} onChange={event => changeFilter(setProgram, event.target.value)}><option value="">All courses</option>{data?.programs.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="text-sm font-semibold">From date (Dubai)<input className="control" type="date" value={from} max={to || undefined} onChange={event => changeFilter(setFrom, event.target.value)} /></label>
        <label className="text-sm font-semibold">To date (Dubai)<input className="control" type="date" value={to} min={from || undefined} onChange={event => changeFilter(setTo, event.target.value)} /></label>
        <div className="flex flex-wrap items-end justify-between gap-3 sm:col-span-2 xl:col-span-6"><label className="text-sm font-semibold">Order<select className="control min-w-40" value={sort} onChange={event => changeFilter(setSort, event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label><label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={pending} onChange={event => { setPending(event.target.checked); setPage(1); }} />Pending follow-ups only</label><EnquiryAction onClick={() => { setQuery(""); setStatus(""); setProgram(""); setFrom(""); setTo(""); setSort("newest"); setPending(false); setPage(1); }}>Clear filters</EnquiryAction></div>
      </form>
      {error && <div role="alert" className="m-5 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}<button className="ml-3 min-h-11 font-bold underline" type="button" onClick={() => setRevision(value => value + 1)}>Retry</button></div>}
      <div aria-busy={loading} className="px-5">
        {loading ? <p role="status" className="py-12 text-center text-sm text-muted">Loading enquiries…</p> : error ? null : !data?.enquiries.length ? <div className="py-14 text-center"><h2 className="text-lg font-bold">No enquiries found</h2><p className="mt-2 text-sm text-muted">New homepage enquiries appear here. Try clearing your filters.</p></div> : <>
          <div className="hidden grid-cols-[1.5fr_1fr_1fr_100px_24px] gap-4 border-b border-line py-3 text-xs font-semibold uppercase tracking-wide text-muted lg:grid" aria-hidden="true"><span>Student interest</span><span>Course</span><span>Status</span><span>Received</span><span /></div>
          <div className="divide-y divide-line">{data.enquiries.map(enquiry => <Link key={enquiry.id} href={`/admin/enquiries/${enquiry.id}`} className="grid gap-3 rounded-lg py-5 hover:bg-surface focus-visible:outline-brand lg:grid-cols-[1.5fr_1fr_1fr_100px_24px] lg:items-center lg:gap-4" aria-label={`Open enquiry from ${enquiry.full_name}`}>
            <div className="min-w-0"><h2 className="break-words font-bold text-ink">{enquiry.full_name}</h2><p className="mt-1 break-all text-sm text-muted">{enquiry.phone}</p>{enquiry.email && <p className="mt-1 break-all text-xs text-muted">{enquiry.email}</p>}</div>
            <p className="break-words text-sm font-semibold">{enquiry.programs?.name ?? "Program unavailable"}</p><div><EnquiryStatusBadge status={enquiry.status as EnquiryStatus} /></div><time dateTime={enquiry.created_at} className="text-xs text-muted">{enquiryDate(enquiry.created_at)}</time><ArrowRight size={18} aria-hidden="true" className="hidden text-brand lg:block" />
          </Link>)}</div>
        </>}
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-5"><p className="text-sm tabular-nums text-muted">{data ? `${data.count} matching enquiries · Page ${page} of ${pages}` : "Enquiry register"}</p><div className="flex gap-2"><EnquiryAction disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}>Previous</EnquiryAction><EnquiryAction disabled={loading || page >= pages} onClick={() => setPage(value => value + 1)}>Next</EnquiryAction></div></footer>
    </section>
  </>;
}
