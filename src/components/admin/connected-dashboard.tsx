"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const metrics = [
  { label: "Students", table: "profiles", filter: ["role", "student"], href: "/admin/students" },
  { label: "Faculty", table: "faculty_members", filter: null, href: "/admin/teachers" },
  { label: "Teacher login accounts", table: "profiles", filter: ["role", "teacher"], href: "/admin/teacher-accounts" },
  { label: "Active programs", table: "programs", filter: ["status", "active"], href: "/admin/academic" },
  { label: "Subjects", table: "subjects", filter: null, href: "/admin/academic" },
  { label: "Active questions", table: "questions", filter: ["status", "active"], href: "/admin/questions" },
  { label: "Published tests", table: "tests", filter: ["status", "active"], href: "/admin/tests" },
  { label: "Published recordings", table: "recorded_classes", filter: ["status", "published"], href: "/admin/recorded-classes" },
] as const;

export function ConnectedDashboard() {
  const [counts, setCounts] = useState<number[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const db = createClient();
    void Promise.all(metrics.map(async item => {
      let query = db.from(item.table).select("id", { count: "exact", head: true });
      if (item.filter) query = query.eq(item.filter[0], item.filter[1]);
      const result = await query;
      if (result.error || result.count === null) throw new Error("Unable to load current figures.");
      return result.count;
    })).then(values => { if (active) setCounts(values); }).catch(() => { if (active) setError("Current figures could not be loaded. Please try again."); });
    return () => { active = false; };
  }, []);
  return <div className="mx-auto max-w-6xl"><header><p className="text-xs font-bold uppercase tracking-wider text-brand">ALS administration</p><h1 className="mt-2 text-3xl font-bold">Dashboard</h1><p className="mt-2 text-sm text-muted">Current academic and learning activity.</p></header>{error ? <div role="alert" className="card mt-6 p-6 text-red-800">{error}</div> : <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy={!counts}>{metrics.map((item,index) => <Link key={item.label} href={item.href} className="card min-h-32 p-5"><p className="text-sm text-muted">{item.label}</p>{counts ? <strong className="mt-4 block text-3xl">{counts[index]}</strong> : <div className="skeleton mt-5 h-9 w-20 rounded" aria-hidden="true"/>}</Link>)}</div>}</div>;
}
