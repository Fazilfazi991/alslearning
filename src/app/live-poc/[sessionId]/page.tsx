import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getClassroomData } from "@/lib/live-class/classroom-data";
import { ClassroomScreen } from "@/components/live/classroom-screen";
export default async function Page({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  await requireRole(["admin", "teacher", "student"]);
  const { sessionId } = await params;
  const data = await getClassroomData(sessionId, "poc").catch(() => null);
  if (!data) notFound();
  return <ClassroomScreen data={data}/>;
}
