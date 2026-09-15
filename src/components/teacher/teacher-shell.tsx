"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CircleHelp, ClipboardCheck, FileText, Home, Landmark, Menu, UserCircle, Users, X } from "lucide-react";
import { ALSLogo } from "@/components/shared/als-logo";
import { LogoutButton } from "@/components/shared/logout-button";

const sections = [
  { href: "/teacher", label: "Dashboard", Icon: Home },
  { href: "/teacher/courses", label: "My Courses", Icon: BookOpen },
  { href: "/teacher/students", label: "Students", Icon: Users },
  { href: "/teacher/question-bank", label: "Question Bank", Icon: Landmark },
  { href: "/teacher/assessments", label: "Assessments", Icon: ClipboardCheck },
  { href: "/teacher/content", label: "Study Materials", Icon: FileText },
  { href: "/teacher/profile", label: "Profile", Icon: UserCircle },
  { href: "/teacher/help", label: "Help", Icon: CircleHelp },
] as const;
const active = (path:string,href:string) => href === "/teacher" ? path === href : path.startsWith(href);

export function TeacherShell({children,title}:{children:React.ReactNode;title:string}) {
  const path=usePathname()||"/teacher";
  const [open,setOpen]=useState(false);
  return <div className="min-h-screen bg-[#faf8ff] pb-20 lg:pb-0"><aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-[#ead1da] bg-[#faf8ff] p-4 lg:flex"><ALSLogo/><nav className="mt-8 space-y-1" aria-label="Teacher navigation">{sections.map(({href,label,Icon})=><Link key={href} href={href} aria-current={active(path,href)?"page":undefined} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold ${active(path,href)?"bg-brand/10 text-brand":"text-[#51424a] hover:bg-white"}`}><Icon size={18}/>{label}</Link>)}</nav><div className="mt-auto"><LogoutButton className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold text-red-700"/></div></aside><div className="lg:pl-60"><header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#ead1da] bg-[#faf8ff] px-4 sm:px-6"><strong>{title}</strong><LogoutButton className="hidden min-h-11 items-center gap-2 rounded border bg-white px-3 text-sm font-bold sm:flex"/></header><main className="mx-auto max-w-[1440px] p-4 sm:p-6 lg:p-8">{children}</main></div><nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-white pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Mobile teacher navigation">{sections.slice(0,4).map(({href,label,Icon})=><Link key={href} href={href} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${active(path,href)?"text-brand":"text-[#51424a]"}`}><Icon size={20}/>{label.split(" ")[0]}</Link>)}<button onClick={()=>setOpen(true)} className="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold"><Menu size={20}/>More</button></nav>{open&&<div className="fixed inset-0 z-50 bg-black/35 lg:hidden" onClick={()=>setOpen(false)}><section role="dialog" aria-modal="true" aria-labelledby="teacher-more-title" className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-5" onClick={event=>event.stopPropagation()}><div className="flex items-center justify-between"><h2 id="teacher-more-title" className="text-lg font-bold">More</h2><button onClick={()=>setOpen(false)} aria-label="Close menu" className="grid h-11 w-11 place-items-center"><X/></button></div><nav className="mt-4 grid grid-cols-2 gap-2">{sections.slice(4).map(({href,label,Icon})=><Link key={href} href={href} onClick={()=>setOpen(false)} className="flex min-h-12 items-center gap-2 rounded border p-3 text-sm font-bold"><Icon size={18}/>{label}</Link>)}</nav><LogoutButton className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded border border-red-200 font-bold text-red-700"/></section></div>}</div>;
}
