import Link from "next/link";
import { studentRecordings } from "@/lib/recorded-classes-server";
import { YouTubePlayer } from "@/components/recorded-classes/youtube-player";
import { NativeRecordedClassPlayer } from "@/components/recorded-classes/native-player";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await studentRecordings();
  const recording = data.recordings.find(r => r.id === id);
  if (!recording || (recording.provider === "youtube" ? !recording.provider_video_id : !recording.storage_key)) return <section className="card mx-auto max-w-3xl p-6"><h1 className="text-xl font-bold">Recording unavailable</h1><p className="my-3 text-sm text-muted">This recording may no longer be available, or your course access may have expired. Contact ALS if you need help.</p><Link className="text-brand underline" href="/student/recorded-classes">Back to Recorded Classes</Link></section>;
  const siblings = data.recordings.filter(r => r.subject_id === recording.subject_id);
  const index = siblings.findIndex(r => r.id === id);
  const previous = siblings[index-1], next = siblings[index+1];
  return <article className="mx-auto max-w-4xl space-y-5">
    <Link href={`/student/recorded-classes?subject=${recording.subject_id}`} className="inline-block py-2 text-sm font-semibold text-brand">← Recorded Classes</Link>
    <div><p className="text-sm text-muted">{data.subjects.find(s => s.id === recording.subject_id)?.name} / {recording.topic_label || data.topics.find(t => t.id === recording.chapter_id)?.name}{recording.subtopic ? ` / ${recording.subtopic}` : ""}</p><h1 className="mt-2 break-words text-2xl font-bold">{recording.title}</h1></div>
    {recording.provider === "native" ? <NativeRecordedClassPlayer recordingId={recording.id} title={recording.title}/> : <YouTubePlayer key={recording.id} videoId={recording.provider_video_id!} title={recording.title}/>}
    {recording.description && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{recording.description}</p>}
    <nav aria-label="Recording sequence" className="grid grid-cols-2 gap-3">{previous ? <Link href={`/student/recorded-classes/${previous.id}`} className="card min-w-0 p-4"><span className="text-xs text-muted">← Previous recording</span><p className="mt-1 break-words text-sm font-semibold">{previous.title}</p></Link> : <div/>}{next && <Link href={`/student/recorded-classes/${next.id}`} className="card min-w-0 p-4 text-right"><span className="text-xs text-muted">Next recording →</span><p className="mt-1 break-words text-sm font-semibold">{next.title}</p></Link>}</nav>
  </article>;
}
