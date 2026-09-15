"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ClipboardCheck, FileQuestion, Grid2X2, Home, LibraryBig, UserRound, Users, Video, X } from "lucide-react";
import { ALSLogo } from "@/components/shared/als-logo";
import { LogoutButton } from "@/components/shared/logout-button";

const items = [
  { href: "/admin", label: "Dashboard", Icon: Home },
  { href: "/admin/students", label: "Enrollments", Icon: Users },
  { href: "/admin/teachers", label: "Faculty directory", Icon: UserRound },
  { href: "/admin/teacher-accounts", label: "Teacher logins", Icon: UserRound },
  { href: "/admin/academic", label: "Programs & Syllabus", Icon: LibraryBig },
  { href: "/admin/questions", label: "Question Bank", Icon: FileQuestion },
  { href: "/admin/tests", label: "Tests", Icon: ClipboardCheck },
  { href: "/admin/recorded-classes", label: "Recorded Classes", Icon: Video },
  { href: "/admin/courses", label: "Videos & Materials", Icon: BookOpen },
] as const;
const isActive = (path: string, href: string) => href === "/admin" ? path === href : path.startsWith(href);

export function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return <div data-admin-shell className="min-h-screen bg-[#faf8ff] pb-20 lg:pb-0"><aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-[#ead1da] bg-[#faf8ff] p-4 lg:flex"><ALSLogo/><nav className="mt-8 space-y-1" aria-label="Admin navigation">{items.map(({href,label,Icon}) => <Link key={href} href={href} aria-current={isActive(path,href)?"page":undefined} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold ${isActive(path,href)?"bg-brand/10 text-brand":"text-[#51424a] hover:bg-white"}`}><Icon size={18}/>{label}</Link>)}</nav><div className="mt-auto"><LogoutButton className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold text-red-700"/></div></aside><div className="lg:pl-60"><header data-admin-topbar className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#ead1da] bg-[#faf8ff] px-4 sm:px-6"><strong>ALS Administration</strong><LogoutButton className="hidden min-h-11 items-center gap-2 rounded border bg-white px-3 text-sm font-bold sm:flex"/></header><main className="mx-auto max-w-[1440px] p-4 sm:p-6 lg:p-8">{children}</main></div><nav aria-label="Mobile admin navigation" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">{items.filter(item => ["/admin","/admin/students","/admin/academic","/admin/questions"].includes(item.href)).map(({href,label,Icon}) => <Link key={href} href={href} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${isActive(path,href)?"text-brand":"text-[#625761]"}`}><Icon size={20}/>{label.split(" ")[0]}</Link>)}<button onClick={() => setOpen(true)} aria-expanded={open} className="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold"><Grid2X2 size={20}/>More</button></nav>{open&&<div className="fixed inset-0 z-50 bg-black/40 lg:hidden" onClick={() => setOpen(false)}><section role="dialog" aria-modal="true" aria-labelledby="admin-more-title" className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-2xl bg-white p-5" onClick={event => event.stopPropagation()}><div className="flex items-center justify-between"><h2 id="admin-more-title" className="text-xl font-bold">More</h2><button onClick={() => setOpen(false)} aria-label="Close more menu" className="grid h-11 w-11 place-items-center"><X/></button></div><nav className="mt-4 grid grid-cols-2 gap-2">{items.filter(item => !["/admin","/admin/students","/admin/academic","/admin/questions"].includes(item.href)).map(({href,label,Icon}) => <Link key={href} href={href} onClick={() => setOpen(false)} className="flex min-h-12 items-center gap-2 rounded border p-3 text-sm font-bold"><Icon size={18}/>{label}</Link>)}</nav><LogoutButton className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded border border-red-200 font-bold text-red-700"/></section></div>}</div>;
}
