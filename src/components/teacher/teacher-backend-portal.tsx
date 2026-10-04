import { CoreManager } from "@/components/admin/core-manager";
import { QuestionBank } from "@/components/admin/question-bank";
import { BookOpen, ClipboardCheck, FileQuestion, FileText, Users } from "lucide-react";
import Link from "next/link";
import { TeacherShell } from "./teacher-shell";
import { getTeacherData, type TeacherStudent } from "@/lib/teacher-data";
import { ChangePassword } from "@/components/shared/change-password";
import { liveClassConfiguration } from "@/lib/live-class/config";
import { stagingTestWindowOpen } from "@/lib/live-class/staging-window";
import { formatAcademicDate } from "@/lib/live-class/date";

const titles: Record<string, string> = {
  dashboard: "Teacher Dashboard", courses: "My Courses", students: "Students",
  "live-classes": "Live Classes", assessments: "Assessments & Tests",
  "question-bank": "Question Bank", content: "Study Materials",
  profile: "My Profile", settings: "Settings", help: "Help & Support",
};

export async function TeacherBackendPortal({ section = "dashboard", page = 0, search = "" }:
  { section?: string; page?: number; search?: string }) {
  const title = titles[section] || titles.dashboard;
  if (section === "content") return <TeacherShell title={title}><CoreManager mode="content" /></TeacherShell>;
  if (section === "assessments") return <TeacherShell title={title}><CoreManager mode="tests" /></TeacherShell>;
  if (section === "question-bank") return <TeacherShell title={title}><QuestionBank /></TeacherShell>;
  if (section === "settings") return <TeacherShell title={title}><ChangePassword /></TeacherShell>;
  if (section === "help") return <TeacherShell title={title}><HonestState title="Help & Support" body="Support messaging is not configured in this workspace yet. No request is sent from this page." /></TeacherShell>;
  let data: Awaited<ReturnType<typeof getTeacherData>>;
  try { data = await getTeacherData(section, page, search); }
  catch { return <TeacherShell title={title}><div role="alert" className="card p-5">Could not load this Teacher workspace. Please refresh and retry.</div></TeacherShell>; }
  if (!data) return null;
  const programs = [...new Map(data.assignments.filter(a => a.programs).map(a => [a.programs!.id, a.programs!])).values()];
  const subjects = [...new Map(data.assignments.filter(a => a.subjects).map(a => [a.subjects!.id, a.subjects!])).values()];
  return <TeacherShell title={title}>
    <header className="mb-6">
      <p className="text-xs font-bold uppercase tracking-wide text-brand">ALS Teacher</p>
      <h1 className="mt-2 text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted">{data.user.full_name || data.user.email}</p>
    </header>
    {section === "dashboard" && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Metric icon={BookOpen} value={subjects.length} label="Assigned subjects" href="/teacher/courses" />
        <Metric icon={Users} value={data.studentCount} label="Scoped enrollments" href="/teacher/students" />
        <Metric icon={FileQuestion} value={data.questionCount} label="Visible questions" href="/teacher/question-bank" />
        <Metric icon={ClipboardCheck} value={data.testCount} label="Accessible assessments" href="/teacher/assessments" />
        <Metric icon={FileText} value={data.contentCount} label="Accessible materials" href="/teacher/content" />
      </div>
      <section className="card mt-5 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">Your teaching scope</h2><p className="mt-1 text-sm text-muted">Counts above reflect records visible to your assigned Teacher account.</p></div><Link href="/teacher/courses" className="inline-flex min-h-11 items-center font-bold text-brand">View courses →</Link></div>
        {programs.length?<ul className="mt-4 grid gap-3 sm:grid-cols-2">{programs.map(program=><li key={program.id} className="rounded-lg border border-line bg-surface p-4"><p className="font-bold">{program.name}</p><p className="mt-1 text-sm text-muted">{new Set(data.assignments.filter(a=>a.program_id===program.id&&a.subject_id).map(a=>a.subject_id)).size} assigned subjects · {data.batches.filter(b=>b.program_id===program.id).length} assigned batches</p></li>)}</ul>:<p className="mt-4 text-sm text-muted">No program assigned yet. An ALS administrator can add your teaching scope.</p>}
      </section>
      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Teacher quick actions">
        {[["Open question bank","/teacher/question-bank"],["Review students","/teacher/students"],["Manage materials","/teacher/content"],["View live classes","/teacher/live-classes"]].map(([label,href])=><Link key={href} href={href} className="flex min-h-12 items-center rounded-lg border border-line bg-white px-4 text-sm font-bold text-brand hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{label} →</Link>)}
      </section>
    </>}
    {section === "courses" && (programs.length
      ? <div className="space-y-4">{programs.map(program => {
          const assignedSubjects=[...new Map(data.assignments.filter(a=>a.program_id===program.id&&a.subjects).map(a=>[a.subjects!.id,a.subjects!])).values()];
          const assignedBatches=data.batches.filter(batch=>batch.program_id===program.id);
          return <section className="card p-5 sm:p-6" key={program.id}>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">{program.name}</h2><p className="mt-1 text-sm text-muted">{assignedSubjects.length} assigned subjects · {assignedBatches.length} assigned batches</p></div><Link href="/teacher/students" className="inline-flex min-h-11 items-center text-sm font-bold text-brand">View students →</Link></div>
            <div className="mt-5 grid gap-5 lg:grid-cols-2"><div><h3 className="text-sm font-bold">Subjects</h3>{assignedSubjects.length?<ul className="mt-3 flex flex-wrap gap-2">{assignedSubjects.map(subject=><li key={subject.id} className="rounded-full border border-line bg-surface px-3 py-2 text-sm font-semibold">{subject.name}</li>)}</ul>:<p className="mt-2 rounded-lg bg-surface p-3 text-sm text-muted">No subjects assigned to this Program. An ALS administrator can check its subject mapping and your Teacher assignment.</p>}</div>
              <div><h3 className="text-sm font-bold">Assigned batches</h3>{assignedBatches.length?<ul className="mt-2 space-y-2">{assignedBatches.map(batch=><li key={batch.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3 text-sm"><span className="font-semibold">{batch.name}</span><span className="rounded-full bg-surface px-2 py-1 text-xs font-bold capitalize">{batch.status.replaceAll("_"," ")}</span></li>)}</ul>:<p className="mt-2 text-sm text-muted">No batch assigned to you in this Program.</p>}</div></div>
            <nav aria-label={`${program.name} workspaces`} className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">{[["Study materials","/teacher/content"],["Question bank","/teacher/question-bank"],["Assessments","/teacher/assessments"],["Live classes","/teacher/live-classes"]].map(([label,href])=><Link key={href} href={href} className="inline-flex min-h-11 items-center rounded-lg border border-line px-3 text-sm font-bold text-brand hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{label} →</Link>)}</nav>
          </section>;
        })}</div>
      : <HonestState title="No assigned courses" body="An ALS administrator can assign a program and subjects to your Teacher account." />)}
    {section === "students" && <>
      <form className="mb-5 flex max-w-lg flex-wrap gap-2" action="/teacher/students"><label className="min-w-48 flex-1 text-sm font-semibold">Search assigned students
        <input name="search" defaultValue={search} type="search" className="mt-1 min-h-11 w-full rounded-lg border border-line px-3" placeholder="Name, email or program" /></label>
        <button className="self-end rounded-lg bg-brand px-4 py-3 text-sm font-bold text-white">Search</button>{search&&<Link href="/teacher/students" className="inline-flex min-h-11 items-center self-end px-2 text-sm font-bold text-brand">Clear search</Link>}</form>
      <p className="mb-4 text-sm text-muted">{data.studentCount} {search?"matching":"scoped"} enrollment{data.studentCount===1?"":"s"}. A Student enrolled in two Programs appears once per Program.</p>
      {data.students.length ? <div className="space-y-3">{data.students.map((student: TeacherStudent) => <article className="card p-5" key={student.id}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold">{student.name}</h2><p className="mt-1 break-all text-xs text-muted">{student.email}</p>
          <p className="mt-2 text-sm font-semibold">{student.program}{student.batch ? ` · ${student.batch}` : " · Program-wide"}</p></div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${student.status==="active"?"bg-green-50 text-green-800":"bg-amber-50 text-amber-900"}`}>{student.status}</span></div>
        <p className="mt-3 text-sm text-muted">Access expires: {student.expires_at ? `${formatAcademicDate(student.expires_at,process.env.ALS_ACADEMIC_TIME_ZONE||"Asia/Dubai")} (${process.env.ALS_ACADEMIC_TIME_ZONE||"Asia/Dubai"})` : "No expiry set"}</p>
        {student.status!=="active"&&<p className="mt-2 text-xs text-muted">This enrollment is not currently eligible for learning access.</p>}
      </article>)}</div> : <HonestState title={search?"No matching students":"No assigned students"} body={search?"Try another name, email or Program, or clear the search.":"No Student enrollment is currently visible through your assigned Program and batch."} />}
      <nav className="mt-5 flex items-center justify-between gap-3 text-sm" aria-label="Student pages">
        {page===0?<span className="text-muted">Previous</span>:<Link className="min-h-11 content-center font-bold text-brand" href={`/teacher/students?page=${page-1}${search ? `&search=${encodeURIComponent(search)}` : ""}`}>Previous</Link>}
        <span>Page {page + 1} of {Math.max(1,Math.ceil(data.studentCount/25))}</span>
        {(page+1)*25>=data.studentCount?<span className="text-muted">Next</span>:<Link className="min-h-11 content-center font-bold text-brand" href={`/teacher/students?page=${page+1}${search ? `&search=${encodeURIComponent(search)}` : ""}`}>Next</Link>}
      </nav>
    </>}
    {section === "live-classes" && <><Link href="/teacher/live-classes/new" className="mb-5 inline-flex min-h-11 items-center rounded-xl bg-brand px-4 font-bold text-white">Schedule live class</Link><TeacherLiveClasses sessions={data.sessions} configuration={liveClassConfiguration()} timeZone={process.env.ALS_ACADEMIC_TIME_ZONE || "Asia/Dubai"}/></>}
    {section === "profile" && <section className="card max-w-2xl p-5"><h2 className="text-lg font-bold">{data.user.full_name || "ALS Teacher"}</h2>
      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        <div><dt className="font-bold">Email</dt><dd className="mt-1 text-muted">{data.user.email}</dd></div>
        <div><dt className="font-bold">Role</dt><dd className="mt-1 capitalize text-muted">{data.user.role}</dd></div>
        <div><dt className="font-bold">Assigned program</dt><dd className="mt-1 text-muted">{programs.map(p => p.name).join(", ") || "None"}</dd></div>
        <div><dt className="font-bold">Assigned subjects</dt><dd className="mt-1 text-muted">{subjects.map(s => s.name).join(", ") || "None"}</dd></div>
      </dl></section>}
    {section === "profile" && <ChangePassword />}
  </TeacherShell>;
}

function TeacherLiveClasses({ sessions, configuration, timeZone }: { sessions: NonNullable<Awaited<ReturnType<typeof getTeacherData>>>["sessions"]; configuration: ReturnType<typeof liveClassConfiguration>; timeZone: string }) {
  const entryAvailable=configuration.classroomEnabled&&configuration.realtimeConfigured&&stagingTestWindowOpen();
  return <div>{!entryAvailable&&<p role="status" className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">Live media is currently unavailable. Scheduled class details remain visible; the release owner will confirm the next testing window.</p>}
    {sessions.length ? <div className="grid gap-4 lg:grid-cols-2">{sessions.map(session => {
      const subject = Array.isArray(session.subjects) ? session.subjects[0] : session.subjects;
      const batch = Array.isArray(session.batches) ? session.batches[0] : session.batches;
      const recordings = session.class_recordings || [];
      const canEnter=entryAvailable&&session.provider==="cloudflare"&&(session.status==="scheduled"||session.status==="live");
      const publishedReplay=recordings.some(recording=>recording.status==="published"&&recording.published_at);
      return <article key={session.id} className="card flex min-w-0 flex-col p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-brand">{subject?.name || "Live learning"}</p><h2 className="mt-2 text-lg font-bold">{session.title}</h2></div><span className="rounded-full bg-surface px-3 py-1 text-xs font-bold uppercase">{session.status}</span></div><p className="mt-3 text-sm text-muted">{batch?.name || "Assigned cohort"} · {formatAcademicDate(session.starts_at, timeZone)}</p><p className="mt-2 text-xs text-muted">{session.status==="completed"?publishedReplay?"This class has ended · published replay available":"This class has ended":session.status==="scheduled"?"Scheduled class":"Class in progress"}</p><div className="mt-auto pt-5">{canEnter?<Link href={`/teacher/live-classes/${session.id}`} className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-bold text-white">{session.status==="live"?"Open classroom":"Start or join class"}</Link>:session.status==="completed"?<Link href={`/teacher/live-classes/${session.id}`} className="inline-flex min-h-11 items-center font-bold text-brand">View class details →</Link>:<span className="inline-flex min-h-11 items-center rounded-xl bg-amber-50 px-4 text-sm font-bold text-amber-900">Live entry currently unavailable</span>}</div></article>;
    })}</div> : <HonestState title="No assigned live classes" body="An ALS administrator can schedule a class against your authenticated Teacher account and current academic assignment."/>}
  </div>;
}

function Metric({ icon: Icon, value, label, href }: { icon: typeof BookOpen; value: number; label: string; href: string }) {
  return <Link href={href} className="card block min-h-36 p-5 transition hover:border-brand"><Icon className="text-brand" />
    <strong className="mt-3 block text-3xl">{value}</strong><span className="text-sm text-muted">{label}</span></Link>;
}
function HonestState({ title, body }: { title: string; body: string }) {
  return <section className="card max-w-2xl p-7"><h2 className="font-bold">{title}</h2><p className="mt-2 text-sm text-muted">{body}</p></section>;
}
