"use client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { FileText, PlayCircle } from "lucide-react";
import type { getStudentCourse } from "@/lib/student-courses-server";
import { courseHasContent, recordingHref, selectedCourseSubject } from "@/lib/student-courses";
import { RecordingThumbnail } from "@/components/recorded-classes/recording-thumbnail";

export function CourseLearningHub({ data, basePath }: { data: NonNullable<Awaited<ReturnType<typeof getStudentCourse>>>; basePath: string }) {
  const params = useSearchParams();
  const selected = selectedCourseSubject(data.subjects, params.get("subject") ?? data.selected?.id);
  const recordings = data.recordings.filter(r => r.subject_id === selected?.id);
  const resources = data.resources.filter(r => r.subject_id === selected?.id);
  return <div className="mx-auto min-w-0 max-w-5xl space-y-6">
    <header className="rounded-xl bg-deep-blue p-4 text-white sm:p-5" aria-label="Enrolled program">
      <p className="text-xs font-semibold uppercase text-blue-100">Enrolled program</p>
      <h2 className="mt-1 text-xl font-bold sm:text-2xl">{data.program.name}</h2>
      <p className="mt-2 text-xs text-blue-100">{data.enrollment.access_expires_at ? `Access until ${new Date(data.enrollment.access_expires_at).toLocaleDateString("en-GB")}` : "Access with no expiry"}</p>
    </header>
    <section aria-labelledby="course-subjects">
      <h2 id="course-subjects" className="text-lg font-bold">Subjects</h2>
      <nav aria-label="Course subjects" className="mt-3 flex max-w-full gap-2 overflow-x-auto pb-2">
        {data.subjects.map(s => {
          const count = data.counts.find(c => c.subjectId === s.id)?.count ?? 0;
          return <a key={s.id} href={`${basePath}?subject=${s.id}`} onClick={event => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            window.history.replaceState(null, "", `${basePath}?subject=${s.id}`);
          }} aria-current={selected?.id === s.id ? "page" : undefined} className={`flex min-h-11 shrink-0 flex-col justify-center rounded-xl border px-3 py-2 text-sm font-semibold ${selected?.id === s.id ? "border-brand bg-brand text-white" : "border-line bg-white text-ink hover:border-brand"}`}>
            {s.name}<span className={`mt-0.5 text-xs font-normal ${selected?.id === s.id ? "text-white" : "text-muted"}`}>{count} {count === 1 ? "recording" : "recordings"}</span>
          </a>;
        })}
      </nav>
      {!data.subjects.length && <p className="mt-2 text-sm text-muted">No subjects are assigned yet.</p>}
    </section>
    {selected && <section aria-labelledby="course-content" className="space-y-5">
      <div><h2 id="course-content" className="text-lg font-bold">Learning content</h2><p className="mt-1 text-sm text-muted">{selected.name}</p></div>
      {!courseHasContent(recordings, resources) ? <p role="status" className="rounded-xl border border-line bg-white p-5 text-sm text-muted">No learning content is available for this subject yet.</p> : <>
        <section aria-labelledby="course-recordings">
          <div className="mb-2 flex items-center justify-between gap-3"><h3 id="course-recordings" className="font-bold">Recorded Classes</h3><span className="text-xs text-muted">{recordings.length} {recordings.length === 1 ? "video" : "videos"}</span></div>
          {recordings.length ? <div className="divide-y divide-line rounded-xl border border-line bg-white px-3 sm:px-4">{recordings.map(r => <Link key={r.id} href={recordingHref(r.id)} prefetch={false} className="flex min-w-0 items-center gap-3 py-4">
            {r.provider_video_id ? <RecordingThumbnail videoId={r.provider_video_id}/> : <PlayCircle aria-hidden="true" className="shrink-0 text-brand"/>}
            <div className="min-w-0 flex-1"><p className="text-xs text-muted">{r.topic_label || r.chapters?.name}</p>{r.subtopic && <p className="mt-1 text-xs font-semibold text-brand">{r.subtopic}</p>}<h4 className="mt-1 break-words text-sm font-bold">{r.title}</h4><p className="mt-1 text-xs font-semibold text-brand">Play recording{r.duration_seconds ? ` · ${Math.ceil(r.duration_seconds / 60)} min` : ""}</p></div>
          </Link>)}</div> : <p className="text-sm text-muted">No recorded classes for this subject yet.</p>}
        </section>
        <section aria-labelledby="course-resources"><div className="mb-2 flex items-center justify-between gap-3"><h3 id="course-resources" className="font-bold">Study Materials</h3><span className="text-xs text-muted">{resources.length} items</span></div>
          {resources.length ? <div className="divide-y divide-line rounded-xl border border-line bg-white px-3">{resources.map(r => <Link key={r.id} href={`/student/learn/${r.slug}`} prefetch={false} className="flex min-h-14 items-center gap-3 py-3 text-sm font-semibold"><FileText size={20} aria-hidden="true" className="shrink-0 text-brand"/><span className="break-words">{r.title}</span></Link>)}</div> : <p className="text-sm text-muted">No study materials for this subject yet.</p>}
        </section>
      </>}
    </section>}
  </div>;
}

