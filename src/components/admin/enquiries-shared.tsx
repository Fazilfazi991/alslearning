import Link from "next/link";
import type { ReactNode } from "react";
import { enquiryStatuses, type Enquiry, type EnquiryStatus } from "@/types/enquiries";

export { enquiryStatuses, type Enquiry, type EnquiryStatus };
export const statusLabels: Record<EnquiryStatus, string> = { new: "New", contacted: "Contacted", interested: "Interested", follow_up: "Follow-up", converted: "Converted", closed: "Closed / not interested" };
const statusColors: Record<EnquiryStatus, string> = {
  new: "bg-blue-50 text-blue-800", contacted: "bg-surface text-deep-blue", interested: "bg-green-50 text-green-800",
  follow_up: "bg-amber-50 text-amber-900", converted: "bg-green-50 text-green-800", closed: "bg-surface text-muted",
};
export function EnquiryStatusBadge({ status }: { status: EnquiryStatus }) {
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusColors[status]}`}>{statusLabels[status] ?? status}</span>;
}
export type EnquiryStaff = { id: string; full_name: string; email: string };
export const enquiryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-bold text-ink hover:bg-surface focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50";
export function EnquiryAction({ children, href, onClick, disabled, primary = false, type = "button" }: { children: ReactNode; href?: string; onClick?: () => void; disabled?: boolean; primary?: boolean; type?: "submit" | "button" }) {
  const className = `${enquiryButton} ${primary ? "border-brand! bg-brand! text-white! hover:bg-brand-dark!" : ""}`;
  return href ? <Link href={href} className={className}>{children}</Link> : <button type={type} disabled={disabled} onClick={onClick} className={className}>{children}</button>;
}
export function enquiryDate(value: string | null | undefined, withTime = false) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", ...(withTime ? { timeStyle: "short", timeZone: "Asia/Dubai" } : { timeZone: "Asia/Dubai" }) }).format(new Date(value));
}
export async function enquiryRequest(url: string, method = "GET", payload?: unknown, signal?: AbortSignal) {
  const response = await fetch(url, { method, signal, cache: "no-store", ...(payload ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) } : {}) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Enquiry information could not be loaded. Please retry.");
  return body;
}
