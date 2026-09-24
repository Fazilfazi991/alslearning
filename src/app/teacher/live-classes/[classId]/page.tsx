import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getClassroomData } from "@/lib/live-class/classroom-data";
import { ClassroomScreen } from "@/components/live/classroom-screen";

export default async function Page({ params }: { params: Promise<{ classId: string }> }) {
  await requireRole(["teacher"]);
  const { classId } = await params;
  const data = await getClassroomData(classId, "classroom").catch(() => null);
  if (!data) notFound();
  return <ClassroomScreen data={data}/>;
}
