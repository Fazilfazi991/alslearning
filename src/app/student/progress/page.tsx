import Link from "next/link";
import { BookCheck, BookOpen, Clock3, Target } from "lucide-react";
import { ProgressBar } from "@/components/ui/progress";
import { PageHeader } from "@/components/student/page-header";
import { getStudentPortalData } from "@/lib/student-data";
import { formatWatchTime, one, summarizeStudentTests, summarizeWatchEvents } from "@/lib/student-dashboard";

export default async function Page() {
  const data = await getStudentPortalData();
  if (!data) return null;
  const programs = [...new Map(data.enrollments.flatMap(enrollment => {
    const program = one(enrollment.programs);
    return program ? [[program.id, program] as const] : [];
  })).values()];
  const programIds = new Set(programs.map(program => program.id));
  const content = data.content.filter(item => programIds.has(item.program_id));
  const progress = new Map(data.progress.map(item => [item.content_id, item]));
  const completed = content.filter(item => progress.get(item.id)?.completed).length;
  const tests = summarizeStudentTests(data.tests, data.attempts);
  const watch = summarizeWatchEvents(data.watchEvents ?? null, data.fetchedAt);
  const inProgress = content.filter(item => {
    const itemProgress = progress.get(item.id);
    return itemProgress && !itemProgress.completed && itemProgress.position_seconds > 0;
  });

  return <div className="mx-auto max-w-[1220px]">
    <PageHeader title="Progress" description="Progress across learning content available through your active enrollments." />
    <section className="card p-6">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <Metric icon={BookOpen} value={String(programs.length)} label="Active programs" />
        <Metric icon={BookCheck} value={String(completed)} label="Content completed" />
        <Metric icon={Target} value={String(tests.completed)} label="Tests completed" />
        <Metric icon={Clock3} value={watch === null ? "Unavailable" : watch.intervals ? formatWatchTime(watch.seconds) : "No history yet"} label="Time watched" />
      </div>
      <p className="mt-5 text-xs text-muted">Watch time covers native ALS lessons and recorded classes; it excludes YouTube and live connection time.</p>
      {tests.percentage !== null && <p className="mt-4 text-sm text-muted">Latest visible test results: <b>{tests.earned} / {tests.possible} marks ({Math.round(tests.percentage)}%)</b></p>}
    </section>
    <section className="card mt-6 p-6">
      <h2 className="text-lg font-bold">Program progress</h2>
      <p className="mt-1 text-xs text-muted">Completed out of currently published learning items available for each program.</p>
      <div className="mt-6 space-y-6">
        {programs.map(program => {
          const items = content.filter(item => item.program_id === program.id);
          const done = items.filter(item => progress.get(item.id)?.completed).length;
          return <div key={program.id}><ProgressBar value={items.length ? Math.round(done / items.length * 100) : 0} label={`${program.name} · ${done}/${items.length} items completed`} /></div>;
        })}
        {!programs.length && <p className="text-sm text-muted">No active program progress is available.</p>}
      </div>
    </section>
    <section className="card mt-6 p-6">
      <h2 className="text-lg font-bold">In progress</h2>
      <div className="mt-4 space-y-3">
        {inProgress.map(item => <Link key={item.id} href={`/student/learn/${item.slug}`} className="block rounded border p-3 transition-colors hover:bg-surface">
          <b>{item.title}</b>
          <p className="text-xs text-muted">Resume at {Math.floor((progress.get(item.id)?.position_seconds || 0) / 60)} minutes</p>
        </Link>)}
        {!inProgress.length && <p className="text-sm text-muted">No learning items are currently in progress.</p>}
      </div>
    </section>
  </div>;
}

function Metric({ icon: Icon, value, label }: { icon: typeof BookOpen; value: string; label: string }) {
  return <div><Icon size={19} className="text-brand" aria-hidden="true" /><strong className="mt-3 block text-xl sm:text-2xl">{value}</strong><span className="text-xs text-muted">{label}</span></div>;
}
