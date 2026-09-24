import { CoreManager } from "@/components/admin/core-manager";
import { QuestionBank } from "@/components/admin/question-bank";
import { BookOpen, ClipboardCheck, FileQuestion, FileText, Users } from "lucide-react";
import Link from "next/link";
import { TeacherShell } from "./teacher-shell";
import { getTeacherData, type TeacherStudent } from "@/lib/teacher-data";
import { liveClassConfiguration } from "@/lib/live-class/config";
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
  if (section === "settings") return <TeacherShell title={title}><HonestState title="No configurable settings currently available" body="Your account and assignments are managed by ALS administration." /></TeacherShell>;
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
        <Metric icon={Users} value={data.studentCount} label="Assigned students" href="/teacher/students" />
        <Metric icon={FileQuestion} value={data.questionCount} label="Question Bank" href="/teacher/question-bank" />
        <Metric icon={ClipboardCheck} value={data.testCount} label="Authorized tests" href="/teacher/assessments" />
        <Metric icon={FileText} value={data.contentCount} label="Study materials" href="/teacher/content" />
      </div>
      <section className="card mt-5 p-5"><h2 className="font-bold">Assigned program</h2>
        <p className="mt-2 text-sm text-muted">{programs.map(p => p.name).join(", ") || "No program assigned"}</p>
        <Link href="/teacher/courses" className="mt-4 inline-flex min-h-11 items-center font-bold text-brand">View courses →</Link>
      </section>
    </>}
    {section === "courses" && (programs.length
      ? <div className="space-y-4">{programs.map(program => <section className="card p-5" key={program.id}>
          <h2 className="text-lg font-bold">{program.name}</h2><p className="mt-2 text-sm text-muted">Assigned subjects</p>
          <ul className="mt-3 flex flex-wrap gap-2">{data.assignments.filter(a => a.program_id === program.id && a.subjects).map(a =>
            <li key={a.id} className="rounded-full border border-line px-3 py-2 text-sm font-semibold">{a.subjects!.name}</li>)}</ul>
        </section>)}</div>
      : <HonestState title="No assigned courses" body="An ALS administrator can assign a program and subjects to your Teacher account." />)}
    {section === "students" && <>
      <form className="mb-5 flex max-w-lg gap-2" action="/teacher/students"><label className="min-w-0 flex-1 text-sm font-semibold">Search assigned students
        <input name="search" defaultValue={search} type="search" className="mt-1 min-h-11 w-full rounded-lg border border-line px-3" placeholder="Name, email or program" /></label>
        <button className="self-end rounded-lg bg-brand px-4 py-3 text-sm font-bold text-white">Search</button></form>
      {data.students.length ? <div className="space-y-3">{data.students.map((student: TeacherStudent) => <article className="card p-5" key={student.id}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold">{student.name}</h2>
          <p className="mt-1 text-sm text-muted">{student.program}{student.batch ? ` · ${student.batch}` : ""}</p></div>
          <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold capitalize">{student.status}</span></div>
        <p className="mt-3 text-sm text-muted">Access expires: {student.expires_at ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(student.expires_at)) : "No expiry set"}</p>
      </article>)}</div> : <HonestState title="No assigned students" body="No Student enrollment is currently visible through your assigned program and cohort." />}
      <nav className="mt-5 flex items-center justify-between gap-3 text-sm" aria-label="Student pages">
        <Link aria-disabled={page === 0} className={page === 0 ? "pointer-events-none opacity-50" : "font-bold text-brand"} href={`/teacher/students?page=${Math.max(page - 1, 0)}${search ? `&search=${encodeURIComponent(search)}` : ""}`}>Previous</Link>
        <span>Page {page + 1} · {data.studentCount} assigned students</span>
        <Link aria-disabled={(page + 1) * 25 >= data.studentCount} className={(page + 1) * 25 >= data.studentCount ? "pointer-events-none opacity-50" : "font-bold text-brand"} href={`/teacher/students?page=${page + 1}${search ? `&search=${encodeURIComponent(search)}` : ""}`}>Next</Link>
      </nav>
    </>}
    {section === "live-classes" && <TeacherLiveClasses sessions={data.sessions} configuration={liveClassConfiguration()} timeZone={process.env.ALS_ACADEMIC_TIME_ZONE || "Asia/Dubai"}/>}
    {section === "profile" && <section className="card max-w-2xl p-5"><h2 className="text-lg font-bold">{data.user.full_name || "ALS Teacher"}</h2>
      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        <div><dt className="font-bold">Email</dt><dd className="mt-1 text-muted">{data.user.email}</dd></div>
        <div><dt className="font-bold">Role</dt><dd className="mt-1 capitalize text-muted">{data.user.role}</dd></div>
        <div><dt className="font-bold">Assigned program</dt><dd className="mt-1 text-muted">{programs.map(p => p.name).join(", ") || "None"}</dd></div>
        <div><dt className="font-bold">Assigned subjects</dt><dd className="mt-1 text-muted">{subjects.map(s => s.name).join(", ") || "None"}</dd></div>
      </dl></section>}
  </TeacherShell>;
}

function TeacherLiveClasses({ sessions, configuration, timeZone }: { sessions: NonNullable<Awaited<ReturnType<typeof getTeacherData>>>["sessions"]; configuration: ReturnType<typeof liveClassConfiguration>; timeZone: string }) {
  return <div><div className="mb-5 rounded-xl border border-line bg-white p-4 text-sm"><b>Classroom readiness</b><p className="mt-1 text-muted">Normal entry {configuration.classroomEnabled ? "enabled" : "disabled"} · Realtime {configuration.realtimeConfigured ? "configured" : `missing ${configuration.missingRealtime.join(", ")}`} · Recording {configuration.recordingEnabled && configuration.r2Configured ? "configured" : "not enabled"}</p></div>
    {sessions.length ? <div className="grid gap-4 lg:grid-cols-2">{sessions.map(session => {
      const subject = Array.isArray(session.subjects) ? session.subjects[0] : session.subjects;
      const batch = Array.isArray(session.batches) ? session.batches[0] : session.batches;
      const recordings = session.class_recordings || [];
      return <article key={session.id} className="card flex min-w-0 flex-col p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-brand">{subject?.name || "Live learning"}</p><h2 className="mt-2 text-lg font-bold">{session.title}</h2></div><span className="rounded-full bg-surface px-3 py-1 text-xs font-bold uppercase">{session.status}</span></div><p className="mt-3 text-sm text-muted">{batch?.name || "Assigned cohort"} · {formatAcademicDate(session.starts_at, timeZone)}</p><p className="mt-2 text-xs text-muted">{recordings.length} recording record(s) · {session.recording_enabled ? "capture allowed" : "capture disabled"}</p><div className="mt-auto pt-5"><Link href={`/teacher/live-classes/${session.id}`} className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-bold text-white">Open classroom</Link></div></article>;
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
