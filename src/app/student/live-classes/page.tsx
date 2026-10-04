import { CalendarDays, Play, Radio } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/student/page-header";
import { getStudentPortalData } from "@/lib/student-data";
import { liveClassConfiguration } from "@/lib/live-class/config";
import { formatAcademicDate } from "@/lib/live-class/date";
import { stagingTestWindowOpen } from "@/lib/live-class/staging-window";
import { SessionListRefresh } from "@/components/live/session-list-refresh";

export default async function Page() {
  const data = await getStudentPortalData();
  const sessions = data?.sessions || [];
  const liveConfiguration = liveClassConfiguration();
  const configuration = { ...liveConfiguration, classroomEnabled: liveConfiguration.classroomEnabled && stagingTestWindowOpen() };
  const timeZone = process.env.ALS_ACADEMIC_TIME_ZONE || "Asia/Dubai";
  return <div className="mx-auto max-w-[1220px]"><SessionListRefresh /><PageHeader title="Live Classes" description="Eligible live sessions and published lesson replays for your active cohort."/>
    {!configuration.classroomEnabled && <p className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">Live media is currently unavailable. Your academic access continues, and you can view scheduled class details. The release owner will confirm when a new testing window is available.</p>}
    {sessions.length ? <div className="grid gap-4 lg:grid-cols-2">{sessions.map(session => {
      const recordings = (session.class_recordings || []).filter(recording => recording.status === "published" && recording.published_at);
      const teacher = Array.isArray(session.profiles) ? session.profiles[0] : session.profiles;
      const subject = Array.isArray(session.subjects) ? session.subjects[0] : session.subjects;
      return <article className="card flex min-w-0 flex-col p-5" key={session.id}>
        <div className="flex items-start justify-between gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand">{session.status === "live" ? <Radio/> : recordings.length ? <Play/> : <CalendarDays/>}</span><span className="rounded-full bg-surface px-3 py-1 text-xs font-bold uppercase text-muted">{session.status}</span></div>
        <p className="mt-4 text-xs font-bold uppercase tracking-wide text-brand">{subject?.name || "Live learning"}</p><h2 className="mt-2 text-xl font-bold text-balance">{session.title}</h2>
        <p className="mt-2 text-sm text-muted">{teacher?.full_name || "Assigned Teacher"} · {formatAcademicDate(session.starts_at, timeZone)}</p>
        <div className="mt-auto flex flex-wrap gap-2 pt-5">{session.status === "live" && session.join_available && session.provider === "cloudflare" && configuration.classroomEnabled && configuration.realtimeConfigured && <Link href={`/student/live-classes/${session.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-white"><Radio size={17}/>Join class</Link>}
          {session.status === "live" && (!session.join_available || session.provider !== "cloudflare" || !configuration.classroomEnabled || !configuration.realtimeConfigured) && <span className="inline-flex min-h-11 items-center rounded-xl bg-amber-50 px-4 text-sm font-bold text-amber-900">{!session.join_available ? "Join window closed" : "Live entry not enabled"}</span>}
          {recordings.map(recording => <Link key={recording.id} href={`/student/live-classes/${session.id}?recording=${recording.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-deep-blue/25 px-4 text-sm font-bold text-deep-blue"><Play size={16}/>Replay lesson</Link>)}
          {session.status === "scheduled" && <Link href={`/student/live-classes/${session.id}`} className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-bold">View details</Link>}
        </div>
      </article>;
    })}</div> : <section className="card grid min-h-64 place-items-center text-center"><div><CalendarDays className="mx-auto text-muted"/><h2 className="mt-4 text-lg font-bold">No eligible live classes</h2><p className="mt-2 text-sm text-muted">Classes scheduled for your active cohort will appear here.</p></div></section>}
  </div>;
}
