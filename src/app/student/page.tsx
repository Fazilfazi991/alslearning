import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, Clock3, Play, Target, Trophy } from "lucide-react";
import { getStudentPortalData } from "@/lib/student-data";
import { formatAcademicDate } from "@/lib/live-class/date";
import { formatWatchTime, one, summarizeStudentTests, summarizeWatchEvents } from "@/lib/student-dashboard";

export default async function Dashboard() {
  const data = await getStudentPortalData();
  if (!data) return null;
  const now = data.fetchedAt;
  const programs = [...new Map(data.enrollments.flatMap(enrollment => {
    const program = one(enrollment.programs);
    return program ? [[program.id, program] as const] : [];
  })).values()];
  const programIds = new Set(programs.map(program => program.id));
  const content = data.content.filter(item => programIds.has(item.program_id));
  const progress = new Map(data.progress.map(item => [item.content_id, item]));
  const nextVideo = content.find(item => item.kind === "video" && !progress.get(item.id)?.completed && (progress.get(item.id)?.position_seconds || 0) > 0)
    ?? content.find(item => item.kind === "video" && !progress.get(item.id)?.completed);
  const sessions = data.sessions
    .filter(session => session.status === "live" || (session.status === "scheduled" && Date.parse(session.starts_at) > now))
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const upcoming = sessions.filter(session => session.status === "scheduled");
  const tests = summarizeStudentTests(data.tests, data.attempts);
  const watch = summarizeWatchEvents(data.watchEvents ?? null, now);
  const displayName = data.user.full_name?.trim().split(/\s+/)[0] || "Student";

  return <div className="mx-auto max-w-[1220px] space-y-7">
    <header>
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Welcome back, {displayName}</h1>
      <p className="mt-2 text-sm text-muted">Pick up where you left off, or explore what is ready today.</p>
    </header>
    <section aria-label="Learning at a glance">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat icon={BookOpen} value={String(programs.length)} label="Active programs" />
        <Stat icon={CalendarDays} value={String(upcoming.length)} label="Upcoming classes" />
        <Stat icon={Clock3} value={watch === null ? "Unavailable" : watch.intervals ? formatWatchTime(watch.seconds) : "No history yet"} label="Time watched" />
        <Stat icon={Trophy} value={`${tests.completed} / ${tests.total}`} label="Tests completed / total" />
        <Stat icon={Target} value={String(tests.pending.length)} label="Tests to take" detail={tests.resume.length ? `${tests.resume.length} to resume` : undefined} />
        <Stat icon={Trophy} value={tests.percentage === null ? "No results yet" : `${tests.earned} / ${tests.possible}`} label="Visible marks earned / possible" detail={tests.percentage === null ? undefined : `${Math.round(tests.percentage)}%`} />
      </div>
      <p className="mt-2 text-xs text-muted">Watch time covers native ALS lessons and recorded classes; it excludes YouTube and live connection time.</p>
    </section>
    <section className="brand-gradient rounded-2xl p-5 text-white sm:p-7" aria-labelledby="next-learning-title">
      <p className="text-xs font-bold uppercase tracking-widest text-white/80">Your next step</p>
      <h2 id="next-learning-title" className="mt-2 text-xl font-bold">{nextVideo ? ((progress.get(nextVideo.id)?.position_seconds || 0) > 0 ? "Continue learning" : "Start learning") : "Explore your courses"}</h2>
      <p className="mt-2 text-sm text-white/90">{nextVideo?.title || "Your enrolled programs and learning resources are ready to explore."}</p>
      <Link href={nextVideo ? `/student/learn/${nextVideo.slug}` : "/student/courses"} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-brand">
        {nextVideo ? <Play size={17} aria-hidden="true" /> : <BookOpen size={17} aria-hidden="true" />}{nextVideo ? "Open lesson" : "Browse courses"}
      </Link>
    </section>
    <div className="grid gap-6 lg:grid-cols-2">
      <Section title="My courses" href="/student/courses" action="View all courses">
        {programs.length ? <div className="space-y-3">{programs.slice(0, 3).map(program => {
          const items = content.filter(item => item.program_id === program.id);
          const done = items.filter(item => progress.get(item.id)?.completed).length;
          const subjects = data.subjectMappings.filter(mapping => mapping.program_id === program.id)
            .map(mapping => one(mapping.subjects)?.name).filter(Boolean);
          return <Link key={program.id} href={`/student/courses/${program.slug}`} className="block rounded-xl border border-line p-4 transition-colors hover:bg-surface">
            <h3 className="font-bold">{program.name}</h3>
            {subjects.length > 0 && <p className="mt-1 line-clamp-1 text-xs text-muted">{subjects.join(" · ")}</p>}
            <p className="mt-2 text-xs text-muted">{done} of {items.length} published items completed</p>
          </Link>;
        })}</div> : <Empty text="No active programs are available right now." />}
      </Section>
      <Section title="Upcoming and live classes" href="/student/live-classes" action="View classes">
        {sessions.length ? <div className="space-y-3">{sessions.slice(0, 3).map(session => <Link key={session.id} href={`/student/live-classes/${session.id}`} className="block rounded-xl border border-line p-4 transition-colors hover:bg-surface">
          <div className="flex items-center justify-between gap-3"><h3 className="font-bold">{session.title}</h3><span className="text-xs font-bold text-brand">{session.status === "live" ? "Live now" : "Scheduled"}</span></div>
          <p className="mt-2 text-xs text-muted">{formatAcademicDate(session.starts_at)}</p>
        </Link>)}</div> : <Empty text="No live or upcoming classes are scheduled." />}
      </Section>
      <Section title="Tests to take" href="/student/exams" action="View all tests">
        {tests.resume.length || tests.pending.length ? <div className="space-y-3">
          {[...tests.resume.map(test => ({ ...test, action: "Resume" })), ...tests.pending.map(test => ({ ...test, action: "Start" }))].slice(0, 4).map(test => <Link key={test.id} href={`/student/exams/${test.slug}`} className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-line p-4 transition-colors hover:bg-surface"><span className="font-semibold">{test.title}</span><span className="shrink-0 text-xs font-bold text-brand">{test.action} <ArrowRight size={14} className="inline" aria-hidden="true" /></span></Link>)}
        </div> : <Empty text="No tests are currently ready to take or resume." />}
      </Section>
      <Section title="Recent results" href="/student/exams" action="View results">
        {tests.recent.length ? <div className="space-y-3">{tests.recent.map(result => <div key={result.id} className="flex items-center justify-between gap-3 rounded-xl border border-line p-4"><div><h3 className="font-semibold">{result.test_title || "Test"}</h3><p className="mt-1 text-xs text-muted">{formatAcademicDate(result.submitted_at)}</p></div><strong className="shrink-0 text-sm text-brand">{result.score} / {result.total_marks}</strong></div>)}</div> : <Empty text="No score-visible test results are available yet." />}
      </Section>
    </div>
    {watch && watch.weeklyIntervals > 0 && <section className="card p-5 sm:p-6" aria-label="Weekly activity">
      <h2 className="text-lg font-bold">This week</h2>
      <p className="mt-2 text-sm text-muted">{formatWatchTime(watch.weeklySeconds)} watched across {watch.activeDays} {watch.activeDays === 1 ? "day" : "days"}.</p>
    </section>}
  </div>;
}

function Stat({ icon: Icon, value, label, detail }: { icon: typeof BookOpen; value: string; label: string; detail?: string }) {
  return <div className="card min-h-28 p-4 sm:p-5"><Icon size={18} className="text-brand" aria-hidden="true" /><strong className="mt-3 block text-lg font-extrabold sm:text-xl">{value}</strong><p className="mt-1 text-xs text-muted">{label}</p>{detail && <p className="mt-1 text-xs font-semibold text-brand">{detail}</p>}</div>;
}

function Section({ title, href, action, children }: { title: string; href: string; action: string; children: React.ReactNode }) {
  return <section className="card p-5 sm:p-6"><div className="mb-4 flex items-start justify-between gap-3"><h2 className="text-lg font-bold">{title}</h2><Link href={href} className="shrink-0 text-xs font-bold text-brand hover:underline">{action}</Link></div>{children}</section>;
}

function Empty({ text }: { text: string }) { return <p className="py-4 text-sm text-muted">{text}</p>; }
