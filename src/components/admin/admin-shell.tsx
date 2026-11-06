"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ClipboardCheck, FileQuestion, Grid2X2, Home, LibraryBig, MessageSquare, Radio, UserRound, Users, Video, X } from "lucide-react";
import { ALSLogo } from "@/components/shared/als-logo";
import { useAuthorIdentity } from "./author-identity";
import { LogoutButton } from "@/components/shared/logout-button";

const groups = [
  { label: "Overview", items: [{ href: "/admin", label: "Dashboard", Icon: Home }] },
  { label: "Admissions", items: [
    { href: "/admin/enquiries", label: "Enquiries", Icon: MessageSquare },
    { href: "/admin/students", label: "Students", Icon: Users },
  ] },
  { label: "Academics", items: [
    { href: "/admin/academic", label: "Programs & Batches", Icon: LibraryBig },
    { href: "/admin/teachers", label: "Faculty directory", Icon: UserRound },
    { href: "/admin/teacher-accounts", label: "Teacher logins", Icon: UserRound },
    { href: "/admin/live-classes", label: "Live Classes", Icon: Radio },
    { href: "/admin/recorded-classes", label: "Recorded Classes", Icon: Video },
    { href: "/admin/courses", label: "Learning Materials", Icon: BookOpen },
    { href: "/admin/questions", label: "Question Bank", Icon: FileQuestion },
    { href: "/admin/tests", label: "Exams & Tests", Icon: ClipboardCheck },
  ] },
  { label: "Account", items: [{ href: "/admin/profile", label: "Profile & Password", Icon: UserRound }] },
];
const primary = [groups[0].items[0], ...groups[1].items, groups[2].items[0]];
const isActive = (path: string, href: string) => href === "/admin" ? path === href : path === href || path.startsWith(`${href}/`);

export function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const account = useAuthorIdentity();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.close(); }, [path]);
  const navigation = (mobile = false) => groups.map(group => <div key={group.label} className="mt-6 first:mt-0">
    <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-muted">{group.label}</p>
    <div className="space-y-1">{group.items.map(({ href, label, Icon }) => <Link key={href} href={href} onClick={() => { if (mobile) dialog.current?.close(); }} aria-current={isActive(path, href) ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold ${isActive(path, href) ? "bg-brand/10 text-brand" : "text-[#51424a] hover:bg-white"}`}><Icon size={18} aria-hidden="true"/>{label}</Link>)}</div>
  </div>);
  return <div data-admin-shell className="min-h-screen bg-[#faf8ff] pb-20 lg:pb-0">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col overflow-y-auto border-r border-line bg-[#faf8ff] p-4 lg:flex"><ALSLogo/><nav className="mt-8 pb-4" aria-label="Admin navigation">{navigation()}</nav></aside>
    <div className="lg:pl-60"><header data-admin-topbar className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-[#faf8ff] px-4 sm:px-6"><strong className="text-sm sm:text-base">ALS Administration</strong><div className="flex min-w-0 items-center gap-3"><div className="hidden min-w-0 text-right sm:block"><p className="max-w-56 truncate text-xs font-semibold">{account?.email || account?.full_name || "Admin"}</p><p className="text-[11px] text-muted">Administrator</p></div><LogoutButton className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-bold"/></div></header><main className="mx-auto max-w-[1440px] p-4 sm:p-6 lg:p-8">{children}</main></div>
    <nav aria-label="Mobile admin navigation" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">{primary.map(({ href, label, Icon }) => <Link key={href} href={href} aria-current={isActive(path, href) ? "page" : undefined} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${isActive(path, href) ? "text-brand" : "text-[#625761]"}`}><Icon size={20} aria-hidden="true"/>{href === "/admin/academic" ? "Academics" : label}</Link>)}<button onClick={() => dialog.current?.showModal()} aria-haspopup="dialog" aria-controls="admin-navigation-dialog" className="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold"><Grid2X2 size={20} aria-hidden="true"/>More</button></nav>
    <dialog ref={dialog} id="admin-navigation-dialog" aria-labelledby="admin-more-title" className="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border-0 bg-surface p-5 backdrop:bg-black/40" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}><div className="mb-6 flex items-center justify-between"><h2 id="admin-more-title" className="text-xl font-bold">Administration</h2><button onClick={() => dialog.current?.close()} aria-label="Close navigation" className="grid h-11 w-11 place-items-center rounded-lg border border-line bg-white"><X aria-hidden="true"/></button></div><nav aria-label="All admin pages">{navigation(true)}</nav></dialog>
  </div>;
}
