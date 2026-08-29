"use client";
import { Bell, BookOpen, CalendarDays, ChevronDown, CircleHelp, FileCheck2, GraduationCap, Home, Menu, Search, TrendingUp, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ALSLogo } from "@/components/shared/als-logo";
import { student } from "@/lib/mock-data/student";

const navigation=[
  {label:"Home",href:"/student",icon:Home}, {label:"My Courses",href:"/student/courses",icon:BookOpen},
  {label:"Live Classes",href:"/student/live-classes",icon:CalendarDays}, {label:"Exams & Quizzes",href:"/student/exams",icon:FileCheck2},
  {label:"Progress",href:"/student/progress",icon:TrendingUp}, {label:"Certificates",href:"/student/certificates",icon:GraduationCap},
];
const pageTitle=(path:string)=>navigation.find(x=>x.href!=="/student"&&path.startsWith(x.href))?.label??(path==="/student"?"Dashboard":"Student Portal");

export function StudentShell({children}:{children:React.ReactNode}){
  const path=usePathname(); const[more,setMore]=useState(false);
  if(path.includes("/learn/")||path.endsWith("/take")) return <>{children}</>;
  return <div className="min-h-screen bg-surface">
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[272px] flex-col border-r border-line bg-white p-5 lg:flex">
      <ALSLogo href="/student"/><nav className="mt-9 space-y-1" aria-label="Student navigation">{navigation.map(({label,href,icon:Icon})=><Link key={label} href={href} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${path===href||href!=="/student"&&path.startsWith(href)?"bg-brand/10 text-brand":"text-muted hover:bg-surface hover:text-ink"}`}><Icon size={19}/>{label}</Link>)}</nav>
      <div className="mt-auto space-y-1"><Link href="/student/notifications" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-surface"><Bell size={19}/>Notifications</Link><Link href="/student/help" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-surface"><CircleHelp size={19}/>Help & Support</Link><div className="mt-4 flex items-center gap-3 rounded-xl border border-line p-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-deep-blue text-xs font-bold text-white">{student.initials}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{student.fullName}</p><p className="text-[10px] text-muted">Student</p></div><ChevronDown size={15}/></div></div>
    </aside>
    <div className="lg:pl-[272px]"><header className="sticky top-0 z-30 border-b border-line bg-white/92 backdrop-blur-xl"><div className="flex h-[76px] items-center gap-3 px-4 sm:px-7"><div className="lg:hidden"><ALSLogo compact href="/student"/></div><div className="mr-auto"><p className="hidden text-[10px] font-bold uppercase tracking-[.12em] text-muted sm:block">Student portal</p><h1 className="text-lg font-bold">{pageTitle(path)}</h1></div><label className="relative hidden w-full max-w-sm md:block"><span className="sr-only">Search courses, lessons, topics</span><Search className="absolute left-3 top-3 text-muted" size={18}/><input placeholder="Search courses, lessons, topics..." className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-3 text-sm"/></label><Link href="/student/notifications" className="relative grid h-11 w-11 place-items-center rounded-xl border border-line" aria-label="Notifications"><Bell size={19}/><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand"/></Link><div className="hidden h-10 w-10 place-items-center rounded-full bg-deep-blue text-xs font-bold text-white sm:grid">AM</div></div></header><main className="p-4 pb-28 sm:p-7 lg:pb-8">{children}</main></div>
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-white px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 lg:hidden" aria-label="Mobile student navigation">
      {[{label:"Home",href:"/student",icon:Home},{label:"Courses",href:"/student/courses",icon:BookOpen},{label:"Classes",href:"/student/live-classes",icon:CalendarDays},{label:"Exams",href:"/student/exams",icon:FileCheck2}].map(({label,href,icon:Icon})=><Link key={label} href={href} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-bold ${path===href||href!=="/student"&&path.startsWith(href)?"text-brand":"text-muted"}`}><Icon size={20}/>{label}</Link>)}<button onClick={()=>setMore(true)} className="flex min-h-12 flex-col items-center justify-center gap-1 text-[10px] font-bold text-muted"><Menu size={20}/>More</button>
    </nav>
    {more&&<div className="fixed inset-0 z-50 bg-ink/35 lg:hidden" onClick={()=>setMore(false)}><div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-5" onClick={e=>e.stopPropagation()}><div className="flex items-center justify-between"><h2 className="font-bold">More</h2><button onClick={()=>setMore(false)} className="grid h-10 w-10 place-items-center rounded-xl" aria-label="Close more menu"><X/></button></div><div className="mt-4 grid grid-cols-2 gap-3">{[{label:"Progress",href:"/student/progress",icon:TrendingUp},{label:"Certificates",href:"/student/certificates",icon:GraduationCap},{label:"Notifications",href:"/student/notifications",icon:Bell},{label:"Help",href:"/student/help",icon:CircleHelp},{label:"Profile",href:"/student/help",icon:UserRound}].map(({label,href,icon:Icon})=><Link key={label} href={href} onClick={()=>setMore(false)} className="flex min-h-16 items-center gap-3 rounded-xl border border-line p-3 text-sm font-bold"><Icon className="text-brand" size={19}/>{label}</Link>)}</div></div></div>}
  </div>;
}
