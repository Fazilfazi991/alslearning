import type { ReactNode } from "react";

export const statusLabels: Record<string, string> = { pending: "Pending", ready_for_approval: "Ready for approval", needs_information: "Needs information", approved: "Approved", setup_pending: "Setup link pending", rejected: "Rejected" };
export function setupStatus(status?: string | null) {
  switch (status) {
    case "not_sent": return "Setup link not sent";
    case "failed": return "Setup link failed";
    case "sending": return "Sending setup link";
    case "sent": return "Setup link sent";
    case "not_required": return "Existing student account";
    default: return "Setup status unavailable";
  }
}
export const actionStyle = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-bold text-ink hover:bg-surface focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50";
export const primaryStyle = `${actionStyle} border-brand! bg-brand! text-white! hover:bg-brand-dark!`;
export function Status({ value }: { value: string }) {
  const color = value === "approved" ? "bg-green-50 text-green-800" : value === "needs_information" ? "bg-amber-50 text-amber-900" : value === "rejected" ? "bg-surface text-muted" : "bg-blue-50 text-blue-800";
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${color}`}>{statusLabels[value] || value}</span>;
}
export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-line bg-white p-5 sm:p-6"><h2 className="text-lg font-bold">{title}</h2>{children}</section>;
}
export async function request(url: string, method = "GET", body?: unknown, signal?: AbortSignal) {
  const response = await fetch(url, { method, signal, cache: "no-store", ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "This action could not be completed. Please retry.");
  return data;
}
export function date(value: string) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
