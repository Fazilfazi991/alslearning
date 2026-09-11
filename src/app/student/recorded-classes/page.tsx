import Link from "next/link";
import { PlayCircle } from "lucide-react";
import { studentRecordings } from "@/lib/recorded-classes-server";
import { RecordingThumbnail } from "@/components/recorded-classes/recording-thumbnail";
export default async function Page({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const { subject } = await searchParams;
  const { recordings, subjects, topics, teachers } = await studentRecordings();
  const visible = subject ? recordings.filter(r => r.subject_id === subject) : recordings;
  return <div className="mx-auto max-w-5xl space-y-5">
    <div><Link href="/student/courses" className="text-sm font-semibold text-brand">← My Courses</Link><h1 className="mt-3 text-2xl font-bold">Recorded Classes</h1><p className="mt-1 text-sm text-muted">Revisit your lessons, organized by subject and topic.</p></div>
    {subjects.length > 0 && <nav aria-label="Recording subjects" className="flex flex-wrap gap-2"><Link href="/student/recorded-classes" aria-current={!subject ? "page" : undefined} className={`rounded-lg border px-4 py-3 text-sm ${!subject ? "bg-brand text-white" : "bg-white"}`}>All subjects</Link>{subjects.map(s => <Link key={s.id} href={`?subject=${s.id}`} aria-current={subject === s.id ? "page" : undefined} className={`rounded-lg border px-4 py-3 text-sm ${subject === s.id ? "bg-brand text-white" : "bg-white"}`}>{s.name}</Link>)}</nav>}
    {!visible.length && <div className="card p-6 text-sm text-muted">No recorded classes are available yet.</div>}
    {subjects.filter(s => visible.some(r => r.subject_id === s.id)).map(s => <section key={s.id} className="space-y-4"><h2 className="text-lg font-bold">{s.name}</h2>{topics.filter(t => visible.some(r => r.chapter_id === t.id && r.subject_id === s.id)).map(t => {
      const rows = visible.filter(r => r.chapter_id === t.id);
      const labels = [...new Set(rows.map(r => r.topic_label || t.name))];
      return labels.map(label => <section key={`${t.id}-${label}`} className="rounded-xl border border-line bg-white p-4"><h3 className="font-semibold">{label}</h3>{[...new Set(rows.filter(r => (r.topic_label || t.name) === label).map(r => r.subtopic || ""))].map(group => <div key={group} className="mt-3">{group && <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{group}</h4>}<div className="divide-y divide-line">{rows.filter(r => (r.topic_label || t.name) === label && (r.subtopic || "") === group).map(r => <Link key={r.id} href={`/student/recorded-classes/${r.id}`} className="flex min-w-0 items-center gap-3 rounded-lg py-3 hover:bg-surface focus-visible:outline-brand">
        <RecordingThumbnail videoId={r.provider_video_id!}/>
        <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{r.title}</p><p className="mt-1 text-xs text-muted">{r.duration_seconds ? `${Math.ceil(r.duration_seconds / 60)} min` : "Recorded lesson"}{r.teacher_id && teachers.find(t => t.id === r.teacher_id) ? ` · ${teachers.find(t => t.id === r.teacher_id)?.name}` : ""}</p></div><PlayCircle aria-hidden="true" size={22} className="shrink-0 text-brand"/>
      </Link>)}</div></div>)}</section>);
    })}</section>)}
  </div>;
}
