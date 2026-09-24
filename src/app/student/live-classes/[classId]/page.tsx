import { notFound } from "next/navigation";
import { getClassroomData } from "@/lib/live-class/classroom-data";
import { ClassroomScreen } from "@/components/live/classroom-screen";
import { RecordingPlayback } from "@/components/live/recording-playback";

export default async function Page({ params, searchParams }: { params: Promise<{ classId: string }>; searchParams?: Promise<{ recording?: string }> }) {
  const { classId } = await params;
  const { recording } = searchParams ? await searchParams : {};
  const data = recording
    ? await getClassroomData(classId, "classroom").catch(() => getClassroomData(classId, "poc").catch(() => null))
    : await getClassroomData(classId, "classroom").catch(() => null);
  if (!data) notFound();
  if (recording) {
    const published = data.recordings.find(value => value.id === recording && value.status === "published" && value.published_at);
    if (!published) notFound();
    return <RecordingPlayback classId={classId} recordingId={recording} title={data.session.title}/>;
  }
  return <ClassroomScreen data={data}/>;
}
