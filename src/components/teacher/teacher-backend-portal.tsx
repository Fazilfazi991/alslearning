import { CoreManager } from "@/components/admin/core-manager";
import { QuestionBank } from "@/components/admin/question-bank";
import { AdminBackendManager } from "@/components/admin/admin-backend-manager";
import { BookOpen, CalendarDays, FileQuestion, Users } from "lucide-react";
import Link from "next/link";
import { TeacherShell } from "./teacher-shell";
import { getTeacherData } from "@/lib/teacher-data";

const titles: Record<string,string> = {
  courses: "My Programs", students: "Students", "live-classes": "Live Classes",
  assessments: "Tests", "question-bank": "Question Bank",
  content: "Videos & Materials", checkpoints: "Video Checkpoints",
};

export async function TeacherBackendPortal({section="dashboard"}:{section?:string}) {
  const title=titles[section]||"Teacher Dashboard";
  if(section==="content")return <TeacherShell title={title}><CoreManager mode="content"/></TeacherShell>;
  if(section==="assessments")return <TeacherShell title={title}><CoreManager mode="tests"/></TeacherShell>;
  if(section==="question-bank")return <TeacherShell title={title}><QuestionBank/></TeacherShell>;
  if(section==="checkpoints")return <TeacherShell title={title}><AdminBackendManager mode="checkpoints"/></TeacherShell>;
  let data:Awaited<ReturnType<typeof getTeacherData>>;
  try {data=await getTeacherData(section)} catch {
    return <TeacherShell title={title}><div role="alert" className="card p-5">Could not load assigned records. Please refresh and retry.</div></TeacherShell>;
  }
  if(!data)return null;
  return <TeacherShell title={title}>
    <header className="mb-6">
      <p className="text-xs font-bold uppercase tracking-wide text-brand">Assigned learning</p>
      <h2 className="mt-2 text-2xl font-bold">{title}</h2>
      <p className="mt-2 text-sm text-muted">Signed in as {data.user.full_name||data.user.email}</p>
      {section==="courses"&&<div className="mt-4 flex flex-wrap gap-2"><Link className="rounded bg-brand px-4 py-2 text-sm font-bold text-white" href="/teacher/content">Manage videos & materials</Link></div>}
    </header>
    {section==="dashboard"&&<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={BookOpen} value={data.assignments.length} label="Assignments"/>
      <Metric icon={Users} value={data.studentCount} label="Visible students"/>
      <Metric icon={CalendarDays} value={data.sessions.length} label="Sessions"/>
      <Metric icon={FileQuestion} value={data.questionCount} label="Questions"/>
    </div>}
    {section==="courses"&&<List rows={data.assignments.map(x=>({id:x.id,title:x.programs?.name||x.entrance_exams?.name||"Assignment",detail:x.subjects?.name||"All assigned subjects"}))} empty="No programs or subjects are assigned."/>}
    {section==="students"&&<List rows={data.students.map(x=>({id:x.id,title:x.profiles?.full_name||x.profiles?.email||"Student",detail:`${x.programs?.name||"Program"} · ${x.status}`}))} empty="No students are visible through your assignments."/>}
    {section==="live-classes"&&<List rows={data.sessions.map(x=>({id:x.id,title:x.title,detail:`${x.starts_at?new Date(x.starts_at).toLocaleString():"Not scheduled"} · ${x.provider_room_id?"Room ready":"Provider room unavailable"}`}))} empty="No live classes are scheduled."/>}
    {!["dashboard","courses","students","live-classes"].includes(section)&&<List rows={[]} empty="No records are available in this area yet."/>}
  </TeacherShell>;
}
function Metric({icon:Icon,value,label}:{icon:typeof BookOpen;value:number;label:string}){return <div className="rounded-lg border border-[#e6cbd5] bg-white p-5"><Icon className="text-brand"/><strong className="mt-3 block text-3xl">{value}</strong><p className="text-sm text-muted">{label}</p></div>}
function List({rows,empty}:{rows:{id:string;title:string;detail:string}[];empty:string}){return rows.length?<div className="space-y-3">{rows.map(x=><article className="rounded-lg border border-[#e6cbd5] bg-white p-5" key={x.id}><h3 className="font-bold">{x.title}</h3><p className="mt-2 text-sm text-muted">{x.detail}</p></article>)}</div>:<section className="grid min-h-64 place-items-center rounded-lg border border-[#e6cbd5] bg-white p-8 text-center"><div><BookOpen className="mx-auto text-muted"/><h3 className="mt-4 font-bold">{empty}</h3><p className="mt-2 text-sm text-muted">Ask an administrator to configure the relevant assignment.</p></div></section>}
