"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
type User = {
  id: string;
  role: string;
  full_name: string;
  email: string | null;
};
type Participant = {
  presenter: boolean;
  audio_publish_allowed: boolean;
  screen_publish_allowed: boolean;
  raised_hand: boolean;
} | null;
type Message = {
  id: string;
  body: string;
  created_at: string;
  sender_id: string;
  profiles: { full_name: string }[];
};
type Poll={id:string;question_id:string;launched_at:string|null;closed_at:string|null;show_results:boolean;questions:{prompt:string;question_options:{id:string;content:string;display_order:number}[]}[];live_question_responses:{student_id:string;selected_option_ids:string[]}[]};
export function CloudflareClassroomPoc({
  session,
  user,
  participant,
  initialMessages,
  initialPolls,
  availableQuestions,
  configured,
}: {
  session: { id: string; title: string; faculty_id: string; status: string };
  user: User;
  participant: Participant;
  initialMessages: Message[];
  initialPolls:Poll[];
  availableQuestions:{id:string;prompt:string}[];
  configured: boolean;
}) {
  const local = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    recorder = useRef<MediaRecorder | null>(null),
    chunks = useRef<Blob[]>([]),
    [messages, setMessages] = useState(initialMessages),
    [polls,setPolls]=useState(initialPolls),
    [pollQuestion,setPollQuestion]=useState(""),
    [message, setMessage] = useState(""),
    [raised, setRaised] = useState(Boolean(participant?.raised_hand)),
    [recording, setRecording] = useState(false),
    [recordedBytes, setRecordedBytes] = useState(0),
    [stats] = useState({ audioKbps: 0, videoKbps: 0, screenKbps: 0 }),
    [mediaReady,setMediaReady]=useState(false),
    [error, setError] = useState("");
  const teacher = user.role === "admin" || user.id === session.faculty_id,
    canAudio = teacher || Boolean(participant?.audio_publish_allowed),
    canScreen =
      teacher ||
      Boolean(participant?.presenter && participant?.screen_publish_allowed);
  useEffect(() => {
    const db = createClient();
    void db.rpc("set_live_presence", {
      target_session: session.id,
      joined: true,
    });
    const channel = db
      .channel(`class-${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_messages",
          filter: `session_id=eq.${session.id}`,
        },
        (payload) => setMessages((v) => [...v, payload.new as Message]),
      )
      .on("postgres_changes",{event:"*",schema:"public",table:"live_questions",filter:`session_id=eq.${session.id}`},()=>void refreshPolls())
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"live_question_responses"},()=>void refreshPolls())
      .subscribe();
    async function refreshPolls(){const{data}=await db.from("live_questions").select("id,question_id,launched_at,closed_at,show_results,questions(prompt,question_options(id,content,display_order)),live_question_responses(student_id,selected_option_ids)").eq("session_id",session.id).order("launched_at",{ascending:false});if(data)setPolls(data as unknown as Poll[])}
    const leave = () => {
      void db.rpc("set_live_presence", {
        target_session: session.id,
        joined: false,
      });
    };
    window.addEventListener("pagehide", leave);
    return () => {
      leave();
      window.removeEventListener("pagehide", leave);
      void db.removeChannel(channel);
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, [session.id]);
  async function startMedia() {
    try {
      const value = await navigator.mediaDevices.getUserMedia({
        video: teacher,
        audio: canAudio,
      });
      stream.current = value;
      setMediaReady(true);
      if (local.current) local.current.srcObject = value;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Media permission failed");
    }
  }
  async function share() {
    if (!canScreen) return;
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      stream.current = new MediaStream([
        ...(stream.current?.getTracks() || []),
        ...display.getTracks(),
      ]);
      if (local.current) local.current.srcObject = stream.current;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Screen sharing failed");
    }
  }
  async function raiseHand() {
    const next = !raised;
    const { error: e } = await createClient().rpc("set_raised_hand", {
      target_session: session.id,
      raised: next,
    });
    if (e) setError(e.message);
    else setRaised(next);
  }
  async function send() {
    if (!message.trim()) return;
    const { error: e } = await createClient()
      .from("live_messages")
      .insert({
        session_id: session.id,
        sender_id: user.id,
        body: message.trim(),
      });
    if (e) setError(e.message);
    else setMessage("");
  }
  async function launchPoll(){if(!pollQuestion)return;const{error:e}=await createClient().from("live_questions").insert({session_id:session.id,question_id:pollQuestion,launched_at:new Date().toISOString(),show_results:true});if(e)setError(e.message)}
  async function closePoll(id:string){const{error:e}=await createClient().from("live_questions").update({closed_at:new Date().toISOString()}).eq("id",id);if(e)setError(e.message)}
  async function answerPoll(id:string,option:string){const{error:e}=await createClient().from("live_question_responses").insert({live_question_id:id,student_id:user.id,selected_option_ids:[option]});if(e)setError(e.message)}
  function record() {
    if (!stream.current) return setError("Start local media before recording.");
    chunks.current = [];
    const media = new MediaRecorder(stream.current, {
      mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm",
    });
    media.ondataavailable = (e) => {
      if (e.data.size) {
        chunks.current.push(e.data);
        setRecordedBytes((x) => x + e.data.size);
      }
    };
    media.onstop = () => setRecording(false);
    media.start(5000);
    recorder.current = media;
    setRecordedBytes(0);
    setRecording(true);
  }
  function stopRecord() {
    recorder.current?.stop();
  }
  return (
    <main className="min-h-screen bg-surface p-4 sm:p-7">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5">
          <p className="text-xs font-bold uppercase text-brand">
            Contained Cloudflare Realtime SFU proof of concept
          </p>
          <h1 className="mt-2 text-3xl font-bold">{session.title}</h1>
          {!configured && (
            <p className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-900">
              Cloudflare credentials are not configured. Local media, Supabase
              chat, attendance and permission controls can be exercised; SFU
              publishing is intentionally unavailable.
            </p>
          )}
        </header>
        {error && (
          <p role="alert" className="mb-4 rounded bg-red-50 p-3 text-red-800">
            {error}
          </p>
        )}
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <section className="space-y-4">
            <video
              ref={local}
              autoPlay
              muted
              playsInline
              className="aspect-video w-full rounded-xl bg-black"
            />
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void startMedia()}
                className="rounded bg-brand px-4 py-3 font-bold text-white"
              >
                Start permitted media
              </button>
              <button
                disabled={!canScreen}
                onClick={() => void share()}
                className="rounded border px-4 py-3 disabled:opacity-40"
              >
                Share screen
              </button>
              {!teacher && (
                <button
                  onClick={() => void raiseHand()}
                  className="rounded border px-4 py-3"
                >
                  {raised ? "Lower hand" : "Raise hand"}
                </button>
              )}
              <button
                disabled={!mediaReady || recording}
                onClick={record}
                className="rounded border px-4 py-3"
              >
                Start chunked recording
              </button>
              <button
                disabled={!recording}
                onClick={stopRecord}
                className="rounded border px-4 py-3"
              >
                Stop
              </button>
            </div>
            <section className="card grid gap-3 p-4 sm:grid-cols-4">
              <Metric label="Audio send" value={`${stats.audioKbps} kbps`} />
              <Metric label="Video send" value={`${stats.videoKbps} kbps`} />
              <Metric label="Screen send" value={`${stats.screenKbps} kbps`} />
              <Metric
                label="Recorded chunks"
                value={`${(recordedBytes / 1048576).toFixed(2)} MB`}
              />
            </section>
            <p className="text-sm text-muted">
              SFU getStats instrumentation activates when the Cloudflare
              PeerConnection is established. Current zero values are not
              measurements.
            </p>
          </section>
          <aside className="card flex min-h-[520px] flex-col p-4">
            <h2 className="font-bold">Persistent class chat</h2>
            <div className="my-4 flex-1 space-y-3 overflow-y-auto">
              {messages.map((x) => (
                <div key={x.id} className="rounded bg-surface p-3">
                  <b className="text-xs">
                    {x.profiles[0]?.full_name || "Participant"}
                  </b>
                  <p className="text-sm">{x.body}</p>
                </div>
              ))}
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-20 rounded border p-3"
              placeholder="Write a class message"
            />
            <button
              onClick={() => void send()}
              className="mt-2 rounded bg-brand px-4 py-3 font-bold text-white"
            >
              Send
            </button>
          </aside>
        </div>
        <section className="card mt-5 p-5">
          <h2 className="font-bold">Effective publishing permissions</h2>
          <p className="mt-2 text-sm">
            Camera: {teacher ? "allowed" : "disabled"} · Microphone:{" "}
            {canAudio ? "allowed" : "disabled"} · Screen:{" "}
            {canScreen ? "allowed" : "disabled"}
          </p>
          <p className="mt-2 text-sm text-muted">
            Teacher grant/revoke operations update Supabase participant flags;
            media API requests must re-check these flags server-side before
            publishing tracks.
          </p>
        </section>
        <section className="card mt-5 p-5"><h2 className="font-bold">Live polls</h2>{teacher&&<div className="mt-3 flex flex-col gap-2 sm:flex-row"><select className="min-h-11 flex-1 rounded border px-3" value={pollQuestion} onChange={e=>setPollQuestion(e.target.value)}><option value="">Select an assigned question</option>{availableQuestions.map(q=><option key={q.id} value={q.id}>{q.prompt}</option>)}</select><button onClick={()=>void launchPoll()} className="rounded bg-brand px-4 py-2 font-bold text-white">Launch poll</button></div>}<div className="mt-4 space-y-4">{polls.map(p=>{const question=p.questions[0],own=p.live_question_responses.some(r=>r.student_id===user.id);return <article className="rounded border p-4" key={p.id}><div className="flex justify-between gap-3"><b>{question?.prompt||"Poll question"}</b><span className="text-xs text-muted">{p.closed_at?"Closed":"Active"}</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{question?.question_options.map(o=><button key={o.id} disabled={teacher||own||Boolean(p.closed_at)} onClick={()=>void answerPoll(p.id,o.id)} className="min-h-11 rounded border px-3 text-left disabled:opacity-60">{o.content}</button>)}</div><p className="mt-2 text-xs text-muted">{own?"Response received · ":""}{teacher||p.show_results?`${p.live_question_responses.length} responses`:"Results hidden"}</p>{teacher&&!p.closed_at&&<button onClick={()=>void closePoll(p.id)} className="mt-2 text-sm font-bold text-brand">Close poll</button>}</article>})}{!polls.length&&<p className="text-sm text-muted">No poll has been launched.</p>}</div></section>
      </div>
    </main>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-muted">{label}</p>
      <b>{value}</b>
    </div>
  );
}
