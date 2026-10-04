"use client";
import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "./page-header";
import { createClient } from "@/lib/supabase/client";

type Item = { id: string; kind: string; title: string; body: string; href: string | null; read_at: string | null; created_at: string };
export function NotificationsPage({ initial }: { initial: Item[] }) {
  const [items, setItems] = useState(initial), [filter, setFilter] = useState<"All" | "Unread">("All");
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const shown = items.filter(item => filter === "All" || !item.read_at);
  async function mark(ids: string[]) {
    if (!ids.length || saving.current) return;
    saving.current = true; setBusy(true); setError("");
    try {
      const now = new Date().toISOString();
      const result = await createClient().from("notifications").update({ read_at: now }).in("id", ids).select("id,read_at");
      if (result.error || result.data?.length !== ids.length) throw new Error("Notifications could not be marked as read. Please retry.");
      const saved = new Map(result.data.map(item => [item.id, item.read_at]));
      setItems(current => current.map(item => saved.has(item.id) ? { ...item, read_at: saved.get(item.id) } : item));
    } catch { setError("Notifications could not be marked as read. Please retry."); }
    finally { saving.current = false; setBusy(false); }
  }
  return <div className="mx-auto max-w-4xl">
    <div className="flex flex-col justify-between gap-4 sm:flex-row"><PageHeader title="Notifications" description="Updates generated from your ALS learning activity." /><Button variant="secondary" disabled={busy || !items.some(item => !item.read_at)} onClick={() => void mark(items.filter(item => !item.read_at).map(item => item.id))}><CheckCheck size={17} />{busy ? "Saving…" : "Mark all read"}</Button></div>
    {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <div className="flex gap-2 border-b">{(["All", "Unread"] as const).map(value => <button key={value} onClick={() => setFilter(value)} aria-pressed={filter === value} className="min-h-11 px-4 text-sm font-bold">{value}</button>)}</div>
    {shown.length ? <div className="mt-5 space-y-3">{shown.map(item => {
      const content = <><p className="text-xs font-bold uppercase text-brand">{item.kind.replaceAll("_", " ")}</p><h2 className="font-bold">{item.title}</h2><p className="text-sm text-muted">{item.body}</p></>;
      const href = item.href?.startsWith("/") && !item.href.startsWith("//") ? item.href : null;
      return <article key={item.id} className="card flex gap-4 p-5"><Bell size={18} aria-hidden="true" />{href ? <Link href={href} onClick={() => void mark([item.id])} className="min-w-0 flex-1">{content}</Link> : <button disabled={busy} onClick={() => void mark([item.id])} className="min-w-0 flex-1 text-left">{content}</button>}</article>;
    })}</div> : <div className="mt-5"><EmptyState title={filter === "Unread" ? "No unread notifications" : "No notifications yet"} message="Relevant class, content and test updates will appear here." /></div>}
  </div>;
}
