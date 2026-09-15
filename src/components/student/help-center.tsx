"use client";
import { useState } from "react";
import { ChevronDown, CircleHelp, Search } from "lucide-react";

const faqs = [
  { q: "Where can I find my courses?", a: "Open My Courses to see the programs and subjects included in your active enrollment." },
  { q: "Where can I find recorded classes?", a: "Recorded Classes lists the lessons available to your active program." },
  { q: "Can I retake an assessment?", a: "The attempt limit and availability are shown with each assessment." },
  { q: "Where are my certificates?", a: "Certificates issued to your account will appear in the Certificates area. No certificate is shown until ALS has issued one." },
];

export function HelpCenter() {
  const [open, setOpen] = useState(0);
  const [search, setSearch] = useState("");
  const shown = faqs.filter(item => item.q.toLowerCase().includes(search.toLowerCase()));
  return <div className="mx-auto max-w-4xl"><section className="rounded-2xl bg-deep-blue p-7 text-center text-white sm:p-10"><CircleHelp className="mx-auto text-pink-200"/><h1 className="mt-4 text-3xl font-extrabold">Help & Support</h1><label className="relative mx-auto mt-6 block max-w-xl"><span className="sr-only">Search help articles</span><Search className="absolute left-4 top-3.5 text-muted" size={19}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search help articles..." className="h-12 w-full rounded-xl bg-white pl-12 pr-4 text-sm text-ink"/></label></section><section className="mt-8"><h2 className="text-xl font-bold">Frequently asked questions</h2><div className="mt-4 space-y-3">{shown.map((item,index) => <article key={item.q} className="card overflow-hidden"><button onClick={() => setOpen(open===index?-1:index)} className="flex min-h-14 w-full items-center gap-3 px-5 text-left text-sm font-bold" aria-expanded={open===index}><span className="flex-1">{item.q}</span><ChevronDown className={open===index?"rotate-180":""} size={18}/></button>{open===index&&<p className="border-t border-line px-5 py-4 text-sm leading-6 text-muted">{item.a}</p>}</article>)}{!shown.length&&<p className="card p-5 text-sm text-muted">No help articles match your search.</p>}</div></section><section className="card mt-7 p-6"><h2 className="text-lg font-bold">Contact support</h2><p className="mt-2 text-sm text-muted">Support messaging is not configured in this workspace yet. No request is sent from this page.</p></section></div>;
}
