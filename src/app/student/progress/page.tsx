import Link from "next/link";
import { BookCheck, BookOpen, Clock3, Target } from "lucide-react";
import { ProgressBar } from "@/components/ui/progress";
import { PageHeader } from "@/components/student/page-header";
import { getStudentPortalData } from "@/lib/student-data";
import { createClient } from "@/lib/supabase/server";
import { programLearning, summarizeLearning, type LearningItem } from "@/lib/learning-progress";

export default async function Page() {
  const data = await getStudentPortalData();
  if (!data) return null;
  const db = await createClient();
  const programIds = [...new Set(data.enrollments.map(item => item.program_id))];
  const [recordings, recordedProgress, mapping] = await Promise.all([
    db.from("recorded_classes").select("id,title,subject_id").eq("status", "published"),
    db.from("recorded_class_progress").select("recorded_class_id,last_position_seconds,completed_at").eq("student_id", data.user.id),
    programIds.length ? db.from("program_subjects").select("program_id,subject_id").in("program_id", programIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (recordings.error || recordedProgress.error || mapping.error) throw new Error("Learning progress could not be loaded. Please retry.");
  const contentProgress = new Map(data.progress.map(item => [item.content_id, item]));
  const videoProgress = new Map((recordedProgress.data || []).map(item => [item.recorded_class_id, item]));
  const items: LearningItem[] = data.content.filter(item => programIds.includes(item.program_id)).map(item => ({
    id: `content:${item.id}`, title: item.title, program_id: item.program_id, href: `/student/learn/${item.slug}`,
    position: Number(contentProgress.get(item.id)?.position_seconds || 0), completed: !!contentProgress.get(item.id)?.completed,
  }));
  for (const recording of recordings.data || []) {
    const progress = videoProgress.get(recording.id);
    for (const programId of programIds.filter(id => mapping.data?.some(item => item.program_id === id && item.subject_id === recording.subject_id))) {
      items.push({ id: `recording:${recording.id}:${programId}`, title: recording.title, program_id: programId,
        href: `/student/recorded-classes/${recording.id}`, position: Number(progress?.last_position_seconds || 0), completed: !!progress?.completed_at });
    }
  }
  // A lesson can appear in two programs; count its playback once overall.
  const unique = [...new Map(items.map(item => [item.href, item])).values()];
  const summary = summarizeLearning(unique), inProgress = unique.filter(item => !item.completed && item.position > 0);
  const submitted = data.attempts.filter(item => item.status !== "in_progress");
  const average = submitted.length ? submitted.reduce((sum, item) => sum + Number(item.score || 0), 0) / submitted.length : null;
  return <div className="mx-auto max-w-[1220px]">
    <PageHeader title="Progress" description="Published lessons and classes available through your active enrollments." />
    <section className="card p-6"><div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
      <Metric icon={BookOpen} value={String(programIds.length)} label="Enrolled programs" />
      <Metric icon={BookCheck} value={String(summary.completed)} label="Content completed" />
      <Metric icon={Target} value={String(submitted.length)} label="Tests attempted" />
      <Metric icon={Clock3} value={`${Math.floor(summary.seconds / 3600)}h ${Math.floor(summary.seconds % 3600 / 60)}m`} label="Tracked playback" />
    </div>{average !== null && <p className="mt-5 text-sm text-muted">Average recorded test score: <b>{average.toFixed(1)}</b></p>}</section>
    <section className="card mt-6 p-6"><h2 className="text-lg font-bold">Program progress</h2><p className="mt-1 text-xs text-muted">Includes published learning resources and classes.</p><div className="mt-6 space-y-6">
      {programIds.map(id => { const enrollment = data.enrollments.find(item => item.program_id === id)!;
        const program = Array.isArray(enrollment.programs) ? enrollment.programs[0] : enrollment.programs;
        const progress = programLearning(items, id);
        return <ProgressBar key={id} value={progress.percentage} label={`${program?.name || "Program"} · ${progress.completed}/${progress.total} items completed`} />;
      })}{!programIds.length && <p className="text-sm text-muted">No active program progress is available.</p>}
    </div></section>
    <section className="card mt-6 p-6"><h2 className="text-lg font-bold">In progress</h2><div className="mt-4 space-y-3">{inProgress.map(item => <Link href={item.href} key={item.href} className="block rounded border p-3"><b>{item.title}</b><p className="text-xs text-muted">Resume at {Math.floor(item.position / 60)} minutes</p></Link>)}{!inProgress.length && <p className="text-sm text-muted">No learning items are currently in progress.</p>}</div></section>
  </div>;
}
function Metric({ icon: Icon, value, label }: { icon: typeof BookOpen; value: string; label: string }) {
  return <div><Icon size={19} className="text-brand" /><strong className="mt-3 block text-xl sm:text-2xl">{value}</strong><span className="text-xs text-muted">{label}</span></div>;
}
