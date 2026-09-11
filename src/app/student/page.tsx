import Link from "next/link";
import { BookOpen, Play } from "lucide-react";
import { getStudentPortalData } from "@/lib/student-data";
import { studentRecordingCount } from "@/lib/student-courses-server";
import { DashboardMetrics } from "@/components/student/dashboard-metrics";
export default async function Dashboard() {
  const [data, recordings] = await Promise.all([getStudentPortalData(), studentRecordingCount()]);
  if (!data) return null;
  const nextVideo = data.content.find(c => c.kind === "video" && !data.progress.find(p => p.content_id === c.id && p.completed));
  return <div className="mx-auto max-w-[1220px]">
    <header><h2 className="text-2xl font-extrabold sm:text-3xl">Welcome, {data.user.full_name || "Student"}</h2><p className="mt-2 text-sm text-muted">Your learning at a glance.</p></header>
    <DashboardMetrics programs={data.enrollments.length} sessions={data.sessions.length} tests={data.tests.length} recordings={recordings}/>
    {nextVideo ? <section className="brand-gradient mt-6 rounded-2xl p-5 text-white"><h2 className="text-lg font-bold">Continue learning</h2><p className="mt-2">{nextVideo.title}</p><Link href={`/student/learn/${nextVideo.slug}`} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded bg-white px-4 text-sm font-bold text-brand"><Play size={17}/>Open lesson</Link></section>
    : recordings > 0 ? <section className="mt-6 rounded-xl border border-line bg-white p-5"><h2 className="text-lg font-bold">Ready to learn?</h2><p className="mt-2 text-sm text-muted">Explore recorded classes by subject in My Courses.</p><Link href="/student/courses" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-bold text-white"><BookOpen size={18}/>Browse courses</Link></section>
    : <section className="mt-6 rounded-xl border border-line bg-white p-5"><h2 className="font-bold">Explore your courses</h2><p className="mt-2 text-sm text-muted">Find the learning resources available through your programs.</p><Link href="/student/courses" className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-brand">My Courses</Link></section>}
  </div>;
}
