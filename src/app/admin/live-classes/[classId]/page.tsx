import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { ClassroomScreen } from "@/components/live/classroom-screen";
import { getClassroomData } from "@/lib/live-class/classroom-data";

export default async function Page({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const data = await getClassroomData(classId, "classroom").catch(() => null);
  if (!data) notFound();
  return <AdminShell><ClassroomScreen data={data}/></AdminShell>;
}
