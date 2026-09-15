import { notFound } from "next/navigation";
import Link from "next/link";
import { getStudentPortalData } from "@/lib/student-data";
import { PageHeader } from "@/components/student/page-header";

export default async function Page({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const data = await getStudentPortalData();
  const session = data?.sessions.find(item => item.id === classId);
  if (!session) notFound();
  return <div className="mx-auto max-w-3xl"><PageHeader title={session.title} description={session.starts_at ? new Date(session.starts_at).toLocaleString() : "Schedule pending"}/><section className="card p-6"><p className="text-sm text-muted">Your class details will appear here when the classroom is available.</p><Link href="/student/live-classes" className="mt-5 inline-flex min-h-11 items-center rounded border px-4 text-sm font-bold">Back to live classes</Link></section></div>;
}
