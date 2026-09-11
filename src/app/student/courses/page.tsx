import Link from "next/link";
import { CourseLearningHub } from "@/components/student/course-learning-hub";
import { courseAccess, getStudentCourse } from "@/lib/student-courses-server";
export default async function Page({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const [{ enrollments }, params] = await Promise.all([courseAccess(), searchParams]);
  const programs = [...new Map(enrollments.filter(e => e.programs).map(e => [e.programs!.id, e.programs!])).values()];
  if (programs.length === 1) {
    const data = await getStudentCourse(programs[0].slug, params.subject);
    if (data) return <CourseLearningHub data={data} basePath="/student/courses"/>;
  }
  return <div className="mx-auto max-w-5xl"><h2 className="text-xl font-bold">My Courses</h2><p className="mt-2 text-sm text-muted">Choose an enrolled program to explore its subjects.</p><div className="mt-4 grid gap-3 md:grid-cols-2">{programs.map(p => <Link key={p.id} href={`/student/courses/${p.slug}`} className="rounded-xl border border-line bg-white p-4 font-semibold">{p.name}</Link>)}</div>{!programs.length && <p className="mt-5 rounded-xl border border-line bg-white p-5 text-sm text-muted">No active programs. Your courses will appear when enrollment access is active.</p>}</div>;
}
