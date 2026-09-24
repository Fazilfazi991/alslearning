"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { FixedPartAssembler, sha256Hex, type RecordingPart } from "@/lib/live-class/multipart-buffer";
import {
  acquireRecordingOwnership, deleteRecordingRecovery, downloadRecoveredSegment, listRecordingChunks, listRecordingRecoveries,
  saveRecordingChunk, saveRecordingRecovery, type StoredRecordingRecovery,
} from "@/lib/live-class/recording-store";
import { PeerStatsSampler, type LiveStatsSample } from "@/lib/live-class/stats";
import { formatAcademicDate } from "@/lib/live-class/date";
import { Hand, Maximize, Mic, MicOff, MonitorUp, PhoneOff, Radio, RefreshCw, Video, VideoOff } from "lucide-react";

type User = { id: string; role: "student" | "teacher" | "admin"; full_name: string; email: string | null };
type Participant = { presenter: boolean; audio_publish_allowed: boolean; screen_publish_allowed: boolean; raised_hand: boolean; removed_at?: string | null } | null;
type ManagedParticipant = {
  user_id: string; presenter: boolean; audio_publish_allowed: boolean; screen_publish_allowed: boolean; raised_hand: boolean;
  joined_at: string | null; left_at: string | null; heartbeat_at: string | null; attendance_seconds: number;
  full_name: string;
};
type Message = { id: string; body: string; created_at: string; sender_id: string; sender_name: string };
type Poll = {
  id: string; question_id: string; launched_at: string | null; closed_at: string | null; show_results: boolean;
  prompt: string; options: { id: string; content: string; display_order: number }[]; response_count: number; own_selected: string[];
};
type Session = {
  id: string; title: string; faculty_id: string; status: string; starts_at: string | null; ends_at: string | null;
  recording_enabled: boolean; programs: { name: string } | { name: string }[] | null; batches: { name: string } | { name: string }[] | null;
  subjects: { name: string } | { name: string }[] | null; profiles: { full_name: string } | { full_name: string }[] | null;
};
type Configuration = {
  realtimeConfigured: boolean; r2Configured: boolean; turnConfigured: boolean; recordingEnabled: boolean;
  missingRealtime: string[]; missingR2: string[]; missingTurn: string[];
};
type RecordingRow = { id: string; status: string; total_bytes: number; duration_seconds: number | null; published_at: string | null; error_message: string | null };
type RemoteTrack = { id: string; kind: "microphone" | "camera" | "screen"; ownerId: string; stream: MediaStream };
type Published = { id: string; kind: "microphone" | "camera" | "screen"; mid: string; track: MediaStreamTrack };

const emptyStats: LiveStatsSample = {
  sampledAt: 0, audioBytes: 0, videoBytes: 0, screenBytes: 0, audioKbps: 0, videoKbps: 0, screenKbps: 0,
  packetsLost: 0, jitterMs: null, rttMs: null, candidateType: null, width: null, height: null, framesPerSecond: null,
};
const first = <T,>(value: T | T[] | null | undefined) => Array.isArray(value) ? value[0] : value;
const waitForIce = (peer: RTCPeerConnection) => new Promise<void>(resolve => {
  if (peer.iceGatheringState === "complete") return resolve();
  const timeout = window.setTimeout(done, 8_000);
  function done() { window.clearTimeout(timeout); peer.removeEventListener("icegatheringstatechange", changed); resolve(); }
  function changed() { if (peer.iceGatheringState === "complete") done(); }
  peer.addEventListener("icegatheringstatechange", changed);
});

export function NativeClassroom({
  session, user, participant: initialParticipant, participants: initialParticipants, initialMessages, initialPolls,
  availableQuestions, recordings, configuration, entryEnabled, mode, timeZone,
}: {
  session: Session; user: User; participant: Participant; participants: ManagedParticipant[]; initialMessages: Message[]; initialPolls: Poll[];
  availableQuestions: { id: string; prompt: string }[]; recordings: RecordingRow[]; configuration: Configuration;
  entryEnabled: boolean; mode: "poc" | "classroom"; timeZone: string;
}) {
  const manager = user.role === "admin" || user.id === session.faculty_id;
  const [participant, setParticipant] = useState(initialParticipant);
  const [participants, setParticipants] = useState(initialParticipants);
  const [messages, setMessages] = useState(initialMessages);
  const [hasOlderMessages, setHasOlderMessages] = useState(initialMessages.length === 50);
  const [loadingEarlierMessages, setLoadingEarlierMessages] = useState(false);
  const [polls, setPolls] = useState(initialPolls);
  const [message, setMessage] = useState("");
  const [pollQuestion, setPollQuestion] = useState("");
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<"idle" | "joining" | "connected" | "reconnecting" | "failed" | "ended">("idle");
  const [remoteTracks, setRemoteTracks] = useState<RemoteTrack[]>([]);
  const [published, setPublished] = useState<Published[]>([]);
  const [lowData, setLowData] = useState(false);
  const [preflightReady, setPreflightReady] = useState(false);
  const [cameraRequested, setCameraRequested] = useState(false);
  const [mediaProfile, setMediaProfile] = useState<"lecture" | "demonstration">("lecture");
  const [micLevel, setMicLevel] = useState(0);
  const [stats, setStats] = useState(emptyStats);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState("Not recording");
  const [recordedBytes, setRecordedBytes] = useState(0);
  const [recoveries, setRecoveries] = useState<StoredRecordingRecovery[]>([]);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenPreviewRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const midMapRef = useRef(new Map<string, { id: string; kind: RemoteTrack["kind"]; ownerId: string }>());
  const subscribedRef = useRef(new Set<string>());
  const operationRef = useRef(Promise.resolve());
  const reconnectsRef = useRef(0);
  const recordingStopRef = useRef<(() => void) | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const joinInFlightRef = useRef(false);
  const trackRefreshPromiseRef = useRef<Promise<void> | null>(null);
  const trackRefreshPendingRef = useRef(false);
  const latestMessageRef = useRef(initialMessages.at(-1) ? {
    createdAt: initialMessages.at(-1)!.created_at,
    id: initialMessages.at(-1)!.id,
  } : null);

  const endpoint = `/api/live-classes/${session.id}`;
  const api = useCallback(async <T,>(path: string, body: Record<string, unknown>) => {
    const response = await fetch(`${endpoint}/${path}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, mode }), cache: "no-store",
    });
    const value = await response.json().catch(() => ({})) as T & { error?: string };
    if (!response.ok) throw new Error(value.error || `Classroom request failed (${response.status})`);
    return value;
  }, [endpoint, mode]);

  const queue = useCallback(<T,>(operation: () => Promise<T>) => {
    const result = operationRef.current.then(operation, operation);
    operationRef.current = result.then(() => undefined, () => undefined);
    return result;
  }, []);

  const refreshParticipant = useCallback(async () => {
    const db = createClient();
    const { data } = await db.from("live_participants").select("presenter,audio_publish_allowed,screen_publish_allowed,raised_hand,removed_at")
      .eq("session_id", session.id).eq("user_id", user.id).maybeSingle();
    setParticipant(data as Participant);
    if (data?.removed_at) {
      peerRef.current?.close(); setConnectionState("ended"); setError("You were removed from this live class.");
      return;
    }
    if (!data?.audio_publish_allowed) {
      const microphones = published.filter(value => value.kind === "microphone" && !manager);
      if (microphones.length) {
        await api("media", { action: "close", connectionId, trackIds: microphones.map(value => value.id) }).catch(() => undefined);
        microphones.forEach(value => value.track.stop());
        setPublished(current => current.filter(value => value.kind !== "microphone"));
      }
    }
    if (!(data?.presenter && data.screen_publish_allowed)) {
      const screens = published.filter(value => value.kind === "screen" && !manager);
      if (screens.length) {
        await api("media", { action: "close", connectionId, trackIds: screens.map(value => value.id) }).catch(() => undefined);
        screens.forEach(value => value.track.stop());
        setPublished(current => current.filter(value => value.kind !== "screen"));
      }
    }
  }, [api, connectionId, manager, published, session.id, user.id]);

  const refreshParticipants = useCallback(async () => {
    if (!manager) return;
    const db = createClient();
    await db.rpc("refresh_live_attendance", { target_session: session.id });
    const { data } = await db.rpc("live_participant_roster", { target_session: session.id });
    if (data) setParticipants(data as unknown as ManagedParticipant[]);
  }, [manager, session.id]);

  const refreshPolls = useCallback(async () => {
    const { data } = await createClient().rpc("live_poll_payload", { target_session: session.id });
    if (data) setPolls(data as unknown as Poll[]);
  }, [session.id]);

  const refreshMessages = useCallback(async () => {
    const cursor = latestMessageRef.current;
    const db = createClient();
    const result = cursor
      ? await db.rpc("live_messages_since", {
        target_session: session.id,
        after_created_at: cursor.createdAt,
        after_id: cursor.id,
        page_size: 100,
      })
      : await db.rpc("live_message_page", {
        target_session: session.id,
        before_created_at: null,
        before_id: null,
        page_size: 50,
      });
    const additions = (result.data || []) as unknown as Message[];
    if (!additions.length) return;
    setMessages(current => {
      const byId = new Map(current.map(value => [value.id, value]));
      additions.forEach(value => byId.set(value.id, value));
      return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
    });
    const latest = additions.at(-1)!;
    latestMessageRef.current = { createdAt: latest.created_at, id: latest.id };
  }, [session.id]);

  const subscribeAvailable = useCallback(async (peer: RTCPeerConnection, id: string) => {
    const response = await fetch(`${endpoint}/media?mode=${mode}`, { cache: "no-store" });
    const discovery = await response.json() as { tracks?: { id: string; owner_id: string; kind: RemoteTrack["kind"] }[]; error?: string };
    if (!response.ok) throw new Error(discovery.error || "Track discovery failed");
    const activeIds = new Set((discovery.tracks || []).map(track => track.id));
    setRemoteTracks(current => current.filter(track => {
      if (activeIds.has(track.id)) return true;
      track.stream.getTracks().forEach(media => media.stop());
      subscribedRef.current.delete(track.id);
      return false;
    }));
    const selected = (discovery.tracks || []).filter(track => track.owner_id !== user.id && !subscribedRef.current.has(track.id) && (!lowData || track.kind === "microphone"));
    if (!selected.length) return;
    const value = await api<{ sessionDescription: RTCSessionDescriptionInit; tracks: { id: string; kind: RemoteTrack["kind"]; ownerId: string; mid?: string }[] }>("media", {
      action: "subscribe", connectionId: id, trackIds: selected.map(track => track.id),
    });
    value.tracks.forEach(track => { if (track.mid) midMapRef.current.set(track.mid, track); subscribedRef.current.add(track.id); });
    await peer.setRemoteDescription(value.sessionDescription);
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    await waitForIce(peer);
    await api("media", { action: "renegotiate", connectionId: id, sessionDescription: peer.localDescription });
  }, [api, endpoint, lowData, mode, user.id]);

  const requestTrackRefresh = useCallback(() => {
    if (!peerRef.current || !connectionId) return Promise.resolve();
    trackRefreshPendingRef.current = true;
    if (trackRefreshPromiseRef.current) return trackRefreshPromiseRef.current;
    const operation = queue(async () => {
      while (trackRefreshPendingRef.current) {
        trackRefreshPendingRef.current = false;
        if (peerRef.current) await subscribeAvailable(peerRef.current, connectionId);
      }
    });
    trackRefreshPromiseRef.current = operation;
    void operation.then(() => {
      if (trackRefreshPromiseRef.current === operation) trackRefreshPromiseRef.current = null;
    }, () => {
      if (trackRefreshPromiseRef.current === operation) trackRefreshPromiseRef.current = null;
    });
    return operation;
  }, [connectionId, queue, subscribeAvailable]);

  useEffect(() => {
    const db = createClient();
    let messageTimer: number | null = null;
    let participantTimer: number | null = null;
    let pollTimer: number | null = null;
    const coalesce = (kind: "message" | "participant" | "poll") => {
      const current = kind === "message" ? messageTimer : kind === "participant" ? participantTimer : pollTimer;
      if (current !== null) window.clearTimeout(current);
      const timer = window.setTimeout(() => {
        if (kind === "message") { messageTimer = null; void refreshMessages(); }
        if (kind === "participant") { participantTimer = null; void refreshParticipant(); void refreshParticipants(); }
        if (kind === "poll") { pollTimer = null; void refreshPolls(); }
      }, 150);
      if (kind === "message") messageTimer = timer;
      if (kind === "participant") participantTimer = timer;
      if (kind === "poll") pollTimer = timer;
    };
    const channel = db.channel(`class:${session.id}`, { config: { private: true } })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_messages", filter: `session_id=eq.${session.id}` }, () => coalesce("message"))
      .on("postgres_changes", { event: "*", schema: "public", table: "live_participants", filter: `session_id=eq.${session.id}` }, () => coalesce("participant"))
      .on("postgres_changes", { event: "*", schema: "public", table: "live_questions", filter: `session_id=eq.${session.id}` }, () => coalesce("poll"))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_question_responses" }, () => coalesce("poll"))
      .on("postgres_changes", { event: "*", schema: "public", table: "live_published_tracks", filter: `session_id=eq.${session.id}` }, () => {
        void requestTrackRefresh().catch(() => undefined);
      })
      .subscribe();
    return () => {
      if (messageTimer !== null) window.clearTimeout(messageTimer);
      if (participantTimer !== null) window.clearTimeout(participantTimer);
      if (pollTimer !== null) window.clearTimeout(pollTimer);
      void db.removeChannel(channel);
    };
  }, [refreshMessages, refreshParticipant, refreshParticipants, refreshPolls, requestTrackRefresh, session.id]);

  useEffect(() => {
    const publishedIds = new Set(recordings.filter(value => value.status === "published").map(value => value.id));
    void listRecordingRecoveries().then(async values => {
      const scoped = values.filter(value => value.classId === session.id);
      const releasable = scoped.filter(value => publishedIds.has(value.recordingId));
      await Promise.all(releasable.map(value => deleteRecordingRecovery(value.segmentId)));
      setRecoveries(scoped.filter(value => !publishedIds.has(value.recordingId)));
    }).catch(() => undefined);
  }, [recordings, session.id]);

  useEffect(() => {
    if (!connectionId || !peerRef.current) return;
    let cancelled = false;
    let timer: number | null = null;
    let delay = 60_000;
    const schedule = () => {
      const jitter = Math.floor(Math.random() * 5_000);
      timer = window.setTimeout(async () => {
        try {
          await requestTrackRefresh();
          delay = 60_000;
        } catch {
          delay = Math.min(delay * 2, 300_000);
        }
        if (!cancelled) schedule();
      }, delay + jitter);
    };
    schedule();
    return () => { cancelled = true; if (timer !== null) window.clearTimeout(timer); };
  }, [connectionId, requestTrackRefresh]);

  useEffect(() => {
    if (!connectionId) return;
    const heartbeat = window.setInterval(() => void api("media", { action: "heartbeat", connectionId }).catch(() => setConnectionState("reconnecting")), 15_000);
    return () => window.clearInterval(heartbeat);
  }, [api, connectionId]);

  useEffect(() => {
    if (!manager || !["live", "completed"].includes(session.status)) return;
    const reconcile = () => void api("control", { action: "reconcile" }).catch(() => undefined);
    reconcile();
    const timer = window.setInterval(reconcile, 30_000);
    return () => window.clearInterval(timer);
  }, [api, manager, session.status]);

  useEffect(() => {
    const peer = peerRef.current;
    if (!peer || !connectionId) return;
    const sampler = new PeerStatsSampler(peer, () => screenStreamRef.current?.getVideoTracks()[0]?.id || null);
    const started = new Date().toISOString();
    let samples = 0;
    const interval = window.setInterval(() => void sampler.sample().then(sample => {
      setStats(sample); samples += 1;
      if (samples % 30 === 0) void api("media", {
        action: "stats", connectionId, stats: {
          sampledFrom: started, sampledTo: new Date().toISOString(), audioBytes: sample.audioBytes, videoBytes: sample.videoBytes,
          screenBytes: sample.screenBytes, packetsLost: sample.packetsLost, jitterMs: sample.jitterMs, rttMs: sample.rttMs,
          candidateType: sample.candidateType, reconnectCount: reconnectsRef.current,
        },
      }).catch(() => undefined);
    }).catch(() => undefined), 2_000);
    return () => window.clearInterval(interval);
  }, [api, connectionId]);

  useEffect(() => {
    const peer = peerRef.current;
    return () => {
    peer?.close();
    if (connectionId) void fetch(`${endpoint}/media`, {
      method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "leave", mode, connectionId }),
    });
    };
  }, [connectionId, endpoint, mode]);

  useEffect(() => () => {
    if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    screenStreamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  async function preflight() {
    setError("");
    try {
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: cameraRequested ? mediaProfile === "lecture"
          ? { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 12, max: 15 } }
          : { width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 24, max: 30 } }
          : false,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setPreflightReady(true);
      if (manager && connectionId && peerRef.current) await queue(() => publishLocal(peerRef.current!, connectionId, stream.getTracks()));
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.frequencyBinCount);
      const meter = window.setInterval(() => {
        if (!stream.active) { window.clearInterval(meter); void context.close(); return; }
        analyser.getByteFrequencyData(samples);
        setMicLevel(Math.min(100, Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length * 1.8)));
      }, 120);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Device preflight failed"); }
  }

  async function join(recovery = false) {
    if (!entryEnabled || !configuration.realtimeConfigured || joinInFlightRef.current) return;
    joinInFlightRef.current = true;
    setConnectionState("joining"); setError("");
    try {
      if (recovery) {
        peerRef.current?.close();
        remoteTracks.forEach(value => value.stream.getTracks().forEach(track => track.stop()));
        midMapRef.current.clear(); subscribedRef.current.clear(); setRemoteTracks([]); setPublished([]);
      }
      const created = await api<{ connectionId: string; iceServers: RTCIceServer[] }>("media", { action: "create" });
      const peer = new RTCPeerConnection({ iceServers: created.iceServers, bundlePolicy: "max-bundle" });
      peer.ontrack = event => {
        const identity = midMapRef.current.get(event.transceiver.mid || "");
        if (!identity) return;
        setRemoteTracks(current => [...current.filter(value => value.id !== identity.id), { ...identity, stream: new MediaStream([event.track]) }]);
      };
      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "connected") setConnectionState("connected");
        else if (["disconnected", "failed"].includes(peer.connectionState) && peerRef.current === peer) {
          setConnectionState("reconnecting"); reconnectsRef.current += 1;
          if (reconnectsRef.current <= 3 && reconnectTimerRef.current === null) {
            const delay = [1_000, 3_000, 8_000][reconnectsRef.current - 1];
            reconnectTimerRef.current = window.setTimeout(() => { reconnectTimerRef.current = null; void join(true); }, delay);
          } else if (reconnectsRef.current > 3) setConnectionState("failed");
        }
        else if (peer.connectionState === "closed") setConnectionState("ended");
      };
      peerRef.current = peer; setConnectionId(created.connectionId);
      await queue(() => subscribeAvailable(peer, created.connectionId));
      setConnectionState(peer.connectionState === "connected" ? "connected" : "joining");
      if (localStreamRef.current?.active && (manager ? preflightReady : participant?.audio_publish_allowed)) await publishLocal(peer, created.connectionId, localStreamRef.current.getTracks());
      if (recovery) setNotice("Classroom media reconnected. Re-share the teaching screen if screen capture was active.");
    } catch (reason) { setConnectionState("failed"); setError(reason instanceof Error ? reason.message : "Could not join classroom"); }
    finally { joinInFlightRef.current = false; }
  }

  async function publishLocal(peer: RTCPeerConnection, id: string, tracks: MediaStreamTrack[]) {
    const permitted = tracks.filter(track => track.kind === "audio" ? (manager || participant?.audio_publish_allowed) : manager);
    if (!permitted.length) return;
    const entries = permitted.map(track => {
      const kind: Published["kind"] = track.kind === "audio" ? "microphone" : "camera";
      const transceiver = peer.addTransceiver(track, { direction: "sendonly", streams: [new MediaStream([track])], sendEncodings: [{ maxBitrate: track.kind === "audio" ? 64_000 : mediaProfile === "lecture" ? 450_000 : 1_200_000, maxFramerate: track.kind === "video" ? (mediaProfile === "lecture" ? 15 : 30) : undefined }] });
      return { track, kind, transceiver };
    });
    const offer = await peer.createOffer(); await peer.setLocalDescription(offer); await waitForIce(peer);
    const publications = entries.map(value => ({ kind: value.kind, mid: value.transceiver.mid! }));
    const response = await api<{ sessionDescription: RTCSessionDescriptionInit; tracks: { id: string; kind: Published["kind"]; mid: string }[] }>("media", {
      action: "publish", connectionId: id, sessionDescription: peer.localDescription, publications,
    });
    await peer.setRemoteDescription(response.sessionDescription);
    setPublished(current => [...current.filter(value => !entries.some(entry => entry.kind === value.kind)), ...response.tracks.map((value, index) => ({ ...value, track: entries[index].track }))]);
  }

  async function enableGrantedMicrophone() {
    if (!connectionId || !peerRef.current || (!manager && !participant?.audio_publish_allowed)) return;
    setError("");
    try {
      let track = localStreamRef.current?.getAudioTracks()[0];
      if (!track || track.readyState === "ended") {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
        track = stream.getAudioTracks()[0]; localStreamRef.current = stream;
      }
      await queue(() => publishLocal(peerRef.current!, connectionId, [track!]));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Microphone publication failed"); }
  }

  async function shareScreen() {
    if (!connectionId || !peerRef.current || (!manager && !(participant?.presenter && participant.screen_publish_allowed))) return;
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: mediaProfile === "lecture" ? { ideal: 8, max: 10 } : { ideal: 20, max: 30 } }, audio: false });
      screenStreamRef.current?.getTracks().forEach(track => track.stop()); screenStreamRef.current = display;
      if (screenPreviewRef.current) { screenPreviewRef.current.srcObject = display; await screenPreviewRef.current.play(); }
      const track = display.getVideoTracks()[0];
      const transceiver = peerRef.current.addTransceiver(track, { direction: "sendonly", streams: [display], sendEncodings: [{ maxBitrate: mediaProfile === "lecture" ? 850_000 : 1_800_000, maxFramerate: mediaProfile === "lecture" ? 10 : 30 }] });
      const offer = await peerRef.current.createOffer(); await peerRef.current.setLocalDescription(offer); await waitForIce(peerRef.current);
      const response = await api<{ sessionDescription: RTCSessionDescriptionInit; tracks: { id: string; kind: Published["kind"]; mid: string }[] }>("media", {
        action: "publish", connectionId, sessionDescription: peerRef.current.localDescription,
        publications: [{ kind: "screen", mid: transceiver.mid! }],
      });
      await peerRef.current.setRemoteDescription(response.sessionDescription);
      setPublished(current => [...current.filter(value => value.kind !== "screen"), { ...response.tracks[0], track }]);
      const publicationId = response.tracks[0].id;
      track.onended = () => {
        screenStreamRef.current = null;
        setPublished(current => current.filter(value => value.id !== publicationId));
        void api("media", { action: "close", connectionId, trackIds: [publicationId] }).catch(() => undefined);
        setNotice("Screen sharing ended. The recording canvas will fall back to the Teacher camera or holding slate.");
      };
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Screen sharing failed"); }
  }

  async function changeGrant(targetUserId: string, grant: "microphone" | "presenter", granted: boolean) {
    try {
      const result = await api<{ terminatedPublications: number }>("control", { action: "grant", targetUserId, grant, granted });
      setNotice(`${grant === "microphone" ? "Microphone" : "Presenter"} ${granted ? "granted" : "revoked"}.${!granted ? ` ${result.terminatedPublications} publication(s) terminated.` : ""}`);
      await refreshParticipants();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Permission change failed"); }
  }

  async function removeParticipant(targetUserId: string) {
    try {
      const result = await api<{ terminatedPublications: number; terminatedSubscriptions: number }>("control", { action: "remove", targetUserId });
      setNotice(`Participant removed; ${result.terminatedPublications} publication(s) and ${result.terminatedSubscriptions} subscription(s) were terminated.`);
      await refreshParticipants();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Participant removal failed"); }
  }

  async function lifecycle(action: "start" | "end" | "cancel") {
    try { const result = await api<{ status: string }>("control", { action }); setNotice(`Class is now ${result.status}.`); if (action === "end") setConnectionState("ended"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Class status change failed"); }
  }

  async function sendMessage() {
    if (!message.trim()) return;
    const { error: sendError } = await createClient().from("live_messages").insert({ session_id: session.id, sender_id: user.id, body: message.trim() });
    if (sendError) setError(sendError.message); else setMessage("");
  }

  async function loadEarlierMessages() {
    const oldest = messages[0];
    if (!oldest || loadingEarlierMessages) return;
    setLoadingEarlierMessages(true);
    try {
      const { data, error: pageError } = await createClient().rpc("live_message_page", {
        target_session: session.id,
        before_created_at: oldest.created_at,
        before_id: oldest.id,
        page_size: 50,
      });
      if (pageError) throw pageError;
      const earlier = (data || []) as unknown as Message[];
      setHasOlderMessages(earlier.length === 50);
      if (earlier.length) setMessages(current => {
        const byId = new Map([...earlier, ...current].map(value => [value.id, value]));
        return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Earlier messages could not be loaded");
    } finally {
      setLoadingEarlierMessages(false);
    }
  }

  async function toggleHand() {
    const raised = !participant?.raised_hand;
    const { error: handError } = await createClient().rpc("set_raised_hand", { target_session: session.id, raised });
    if (handError) setError(handError.message); else setParticipant(current => ({ presenter: false, audio_publish_allowed: false, screen_publish_allowed: false, ...current, raised_hand: raised }));
  }

  async function launchPoll() {
    if (!pollQuestion) return;
    const { error: pollError } = await createClient().from("live_questions").insert({ session_id: session.id, question_id: pollQuestion, launched_at: new Date().toISOString(), show_results: false });
    if (pollError) setError(pollError.message); else setPollQuestion("");
  }

  async function answerPoll(id: string, option: string) {
    const { error: pollError } = await createClient().from("live_question_responses").insert({ live_question_id: id, student_id: user.id, selected_option_ids: [option] });
    if (pollError) setError(pollError.message); else await refreshPolls();
  }

  async function updatePoll(id: string, values: { closed_at?: string; show_results?: boolean }) {
    const { error: pollError } = await createClient().from("live_questions").update(values).eq("id", id).eq("session_id", session.id);
    if (pollError) setError(pollError.message); else await refreshPolls();
  }

  function recordingMimeType() {
    return ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/mp4;codecs=avc1,mp4a.40.2", "video/webm"]
      .find(type => MediaRecorder.isTypeSupported(type)) || "";
  }

  async function uploadPart(segmentId: string, part: RecordingPart) {
    const digest = await sha256Hex(part.bytes);
    let response: Response | null = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const signed = await api<{ url: string }>("recordings", { action: "sign", segmentId, partNumber: part.partNumber, byteLength: part.bytes.byteLength, sha256: digest });
      response = await fetch(signed.url, { method: "PUT", body: part.bytes as BodyInit }).catch(() => null);
      if (response?.ok) break;
      await new Promise(resolve => window.setTimeout(resolve, 500 * 2 ** attempt));
    }
    if (!response?.ok) throw new Error("A recording part could not be uploaded after retries");
    const etag = response.headers.get("etag");
    if (!etag) throw new Error("R2 did not expose ETag. Check the bucket CORS ExposeHeaders setting.");
    await api("recordings", { action: "acknowledge", segmentId, partNumber: part.partNumber, byteLength: part.bytes.byteLength, sha256: digest, etag });
    setRecordedBytes(value => value + part.bytes.byteLength);
  }

  async function validateLocalSegment(segmentId: string) {
    const chunks = await listRecordingChunks(segmentId);
    const blob = new Blob(chunks.map(chunk => chunk.bytes), { type: chunks[0]?.mimeType });
    const url = URL.createObjectURL(blob);
    try {
      const video = document.createElement("video"); video.preload = "metadata"; video.src = url;
      await new Promise<void>((resolve, reject) => { video.onloadedmetadata = () => resolve(); video.onerror = () => reject(new Error("Recorded media could not be decoded")); });
      if (!Number.isFinite(video.duration) || video.duration <= 0 || !video.videoWidth) throw new Error("Recorded media metadata is incomplete");
      await api("recordings", { action: "validate", segmentId, durationSeconds: video.duration, seekable: video.seekable.length > 0, hasAudio: true, hasVideo: true });
    } finally { URL.revokeObjectURL(url); }
  }

  async function startRecording() {
    if (!manager || !session.recording_enabled || !configuration.recordingEnabled || !configuration.r2Configured) return;
    const mimeType = recordingMimeType();
    if (!mimeType) return setError("This browser does not expose a supported MediaRecorder container.");
    const audio = localStreamRef.current?.getAudioTracks()[0];
    if (!audio) return setError("Complete microphone preflight before recording.");
    const ownership = await acquireRecordingOwnership(session.id);
    if (!ownership.acquired) return setError("Another tab owns this class recording, or this browser does not support safe cross-tab recording locks.");
    let drawTimer: number | null = null;
    let composite: MediaStream | null = null;
    let activeSegmentId: string | null = null;
    try {
      const continuation = recoveries.find(value => value.status === "interrupted" || value.status === "failed");
      const begun = await api<{ recordingId: string; segmentId: string; segmentNumber: number; partSize: number; contentType: string }>("recordings", { action: "begin", contentType: mimeType, recordingId: continuation?.recordingId });
      activeSegmentId = begun.segmentId;
      const canvas = canvasRef.current!; canvas.width = 1280; canvas.height = 720;
      const context = canvas.getContext("2d")!;
      const draw = () => {
        context.fillStyle = "#101a38"; context.fillRect(0, 0, canvas.width, canvas.height);
        const primaryVideo = screenStreamRef.current ? screenPreviewRef.current : localVideoRef.current;
        if (primaryVideo && primaryVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          context.drawImage(primaryVideo, 0, 0, canvas.width, canvas.height);
        } else {
          context.fillStyle = "white"; context.font = "600 38px sans-serif"; context.textAlign = "center";
          context.fillText(session.title, canvas.width / 2, canvas.height / 2);
        }
        if (screenStreamRef.current && localStreamRef.current?.getVideoTracks().length && localVideoRef.current) {
          context.drawImage(localVideoRef.current, canvas.width - 272, canvas.height - 174, 240, 135);
        }
      };
      drawTimer = window.setInterval(draw, 100); draw();
      composite = canvas.captureStream(10); composite.addTrack(audio.clone());
      const media = new MediaRecorder(composite, { mimeType, videoBitsPerSecond: 900_000, audioBitsPerSecond: 64_000 });
      const assembler = new FixedPartAssembler(begun.partSize);
      let sequence = 0;
      let chain = Promise.resolve();
      let pipelineError: unknown = null;
      await saveRecordingRecovery({
        segmentId: begun.segmentId, recordingId: begun.recordingId, classId: session.id, title: session.title,
        mimeType, partSize: begun.partSize, status: "recording", updatedAt: new Date().toISOString(),
      });
      media.ondataavailable = event => {
        if (!event.data.size) return;
        const currentSequence = sequence++;
        chain = chain.then(async () => {
          await saveRecordingChunk({ id: `${begun.segmentId}:${currentSequence.toString().padStart(8, "0")}`, segmentId: begun.segmentId, recordingId: begun.recordingId, sequence: currentSequence, mimeType, bytes: event.data, createdAt: new Date().toISOString() });
          const bytes = new Uint8Array(await event.data.arrayBuffer());
          for (const part of assembler.push(bytes)) await uploadPart(begun.segmentId, part);
        }).catch(reason => { pipelineError = reason; if (media.state === "recording") media.stop(); });
      };
      media.onerror = event => { pipelineError = event.error || new Error("MediaRecorder stopped unexpectedly"); setRecordingStatus("Interrupted — recover locally"); if (media.state === "recording") media.stop(); };
      const stopped = new Promise<void>(resolve => { media.onstop = () => resolve(); });
      recordingStopRef.current = () => media.stop();
      media.start(5_000); setRecording(true); setRecordedBytes(0); setRecordingStatus(`Recording segment ${begun.segmentNumber}`);
      await stopped; await chain;
      if (pipelineError) throw pipelineError;
      for (const part of assembler.finish()) await uploadPart(begun.segmentId, part);
      await api("recordings", { action: "stop", segmentId: begun.segmentId });
      await saveRecordingRecovery({ segmentId: begun.segmentId, recordingId: begun.recordingId, classId: session.id, title: session.title, mimeType, partSize: begun.partSize, status: "uploading", updatedAt: new Date().toISOString() });
      await api("recordings", { action: "complete", segmentId: begun.segmentId });
      await validateLocalSegment(begun.segmentId);
      const validatingRecovery: StoredRecordingRecovery = {
        segmentId: begun.segmentId, recordingId: begun.recordingId, classId: session.id, title: session.title,
        mimeType, partSize: begun.partSize, status: "validating", updatedAt: new Date().toISOString(),
      };
      await saveRecordingRecovery(validatingRecovery);
      setRecordingStatus("Uploaded — awaiting Admin review");
      setRecoveries(current => [...current.filter(value => value.segmentId !== begun.segmentId), validatingRecovery]);
    } catch (reason) {
      if (activeSegmentId) await api("recordings", { action: "interrupt", segmentId: activeSegmentId }).catch(() => undefined);
      setError(reason instanceof DOMException && reason.name === "QuotaExceededError" ? "Browser recording storage is full. Stop recording and download the recoverable segment." : reason instanceof Error ? reason.message : "Recording failed");
      setRecordingStatus("Interrupted — recovery available");
    } finally {
      if (drawTimer !== null) window.clearInterval(drawTimer);
      composite?.getTracks().forEach(track => track.stop());
      setRecording(false); recordingStopRef.current = null; ownership.release();
    }
  }

  async function resumeRecovery(recovery: StoredRecordingRecovery) {
    setRecordingStatus("Reconciling recovered upload…"); setError("");
    const ownership = await acquireRecordingOwnership(session.id);
    if (!ownership.acquired) { setError("Another tab owns this class recording, or this browser does not support safe cross-tab recording locks."); return; }
    try {
      const reconciled = await api<{ parts: { partNumber: number; present: boolean; providerEtag: string | null }[] }>("recordings", { action: "reconcile", segmentId: recovery.segmentId });
      const present = new Set(reconciled.parts.filter(part => part.present).map(part => part.partNumber));
      const chunks = await listRecordingChunks(recovery.segmentId);
      const assembler = new FixedPartAssembler(recovery.partSize);
      const parts: RecordingPart[] = [];
      for (const chunk of chunks) parts.push(...assembler.push(new Uint8Array(await chunk.bytes.arrayBuffer())));
      parts.push(...assembler.finish());
      for (const part of parts) if (!present.has(part.partNumber)) await uploadPart(recovery.segmentId, part);
      await api("recordings", { action: "stop", segmentId: recovery.segmentId });
      await api("recordings", { action: "complete", segmentId: recovery.segmentId });
      await validateLocalSegment(recovery.segmentId);
      const validatingRecovery = { ...recovery, status: "validating" as const, updatedAt: new Date().toISOString() };
      await saveRecordingRecovery(validatingRecovery);
      setRecoveries(current => [...current.filter(value => value.segmentId !== recovery.segmentId), validatingRecovery]);
      setRecordingStatus("Recovered upload is awaiting Admin review");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Recovery failed"); setRecordingStatus("Recovery still available"); }
    finally { ownership.release(); }
  }

  async function toggleLowData() {
    const next = !lowData; setLowData(next);
    if (next) {
      const visuals = remoteTracks.filter(track => track.kind !== "microphone");
      if (visuals.length && connectionId) await api("media", { action: "unsubscribe", connectionId, trackIds: visuals.map(track => track.id) });
      visuals.forEach(track => { track.stream.getTracks().forEach(media => media.stop()); subscribedRef.current.delete(track.id); });
      setRemoteTracks(current => current.filter(track => track.kind === "microphone"));
      setNotice("Low-data mode is on. Visual teaching content is not currently shown.");
    } else if (peerRef.current && connectionId) {
      subscribedRef.current.clear(); await queue(() => subscribeAvailable(peerRef.current!, connectionId));
    }
  }

  const visual = remoteTracks.find(track => track.kind === "screen") || remoteTracks.find(track => track.kind === "camera");
  return <div className="min-h-screen bg-surface p-0 sm:p-1">
    <div className="mx-auto max-w-[1440px]">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0"><p className="eyebrow">{first(session.subjects)?.name || "ALS live classroom"}</p><h1 className="mt-2 text-2xl font-bold text-balance sm:text-3xl">{session.title}</h1>
          <p className="mt-2 text-sm text-muted">{first(session.profiles)?.full_name || "Assigned Teacher"} · {formatAcademicDate(session.starts_at, timeZone)} · {first(session.batches)?.name || "Eligible cohort"}</p></div>
        <div className="flex flex-wrap gap-2"><span className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-bold ring-1 ring-line"><Radio size={15} className={session.status === "live" ? "text-brand" : "text-muted"}/>{session.status}</span>{manager && session.status === "scheduled" && <Button onClick={() => void lifecycle("start")}>Start class</Button>}{manager && session.status === "live" && <Button onClick={() => void lifecycle("end")} className="bg-red-700!">End class</Button>}</div>
      </header>
      {(!entryEnabled || !configuration.realtimeConfigured) && <p className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-950" role="status">Live entry is disabled. {!entryEnabled ? `${mode === "poc" ? "ALS_LIVE_POC_ENABLED" : "ALS_LIVE_CLASS_ENABLED"} is not enabled.` : `Missing ${configuration.missingRealtime.join(", ")}.`} The academic portal remains available; no successful media state is simulated.</p>}
      {!configuration.turnConfigured && <p className="mb-4 rounded-xl border border-line bg-white p-3 text-sm text-muted">TURN fallback is not configured. Missing {configuration.missingTurn.join(", ")}; SFU app credentials are not reused as TURN credentials.</p>}
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-900">{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-950">{notice}</p>}
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 space-y-4">
          <div id="als-live-stage" className="relative aspect-video min-h-[200px] overflow-hidden rounded-2xl bg-[#101a38] shadow-[0_0_0_1px_rgba(255,255,255,.08)] sm:min-h-[220px]">
            {visual && !lowData ? <RemoteVideo key={visual.id} stream={visual.stream} label={`${visual.kind} teaching stream`}/> : manager ? <video ref={localVideoRef} autoPlay muted playsInline className="h-full w-full object-contain" aria-label="Muted Teacher preview"/> : <div className="grid h-full place-items-center p-6 text-center text-white"><div><VideoOff className="mx-auto text-white/60" size={38}/><h2 className="mt-4 text-xl font-bold">{lowData ? "Audio-only mode" : connectionState === "connected" ? "Waiting for teaching visuals" : "Ready to join"}</h2><p className="mt-2 text-sm text-blue-100">{lowData ? "Visual teaching content is not currently shown." : "Students join receive-only and are not asked for camera or microphone access."}</p></div></div>}
            <video ref={screenPreviewRef} muted playsInline className="hidden" aria-hidden="true"/>
            {remoteTracks.filter(track => track.kind === "microphone").map(track => <RemoteAudio key={track.id} stream={track.stream}/>)}
            <button onClick={() => void document.getElementById("als-live-stage")?.requestFullscreen?.()} className="absolute bottom-3 right-3 grid h-11 w-11 place-items-center rounded-xl bg-black/55 text-white" aria-label="View teaching stage fullscreen"><Maximize size={19}/></button>
          </div>
          <div className="card flex flex-wrap items-center gap-2 p-3">
            {!connectionId ? <Button disabled={!entryEnabled || !configuration.realtimeConfigured || session.status !== "live" || connectionState === "joining"} onClick={() => void join()}>{connectionState === "joining" ? <RefreshCw size={17}/> : <Radio size={17}/>}Join classroom</Button> : <span className="inline-flex min-h-11 items-center rounded-lg bg-green-50 px-4 text-sm font-bold text-green-800">{connectionState}</span>}
            {manager && <Button variant="secondary" onClick={() => void preflight()}>{preflightReady ? <Mic size={17}/> : <Video size={17}/>}Device preflight</Button>}
            {manager && <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm font-semibold"><input type="checkbox" checked={cameraRequested} onChange={event => setCameraRequested(event.target.checked)}/>Camera preview</label>}
            {manager && <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm font-semibold"><span className="sr-only">Media profile</span><select value={mediaProfile} onChange={event => setMediaProfile(event.target.value as "lecture" | "demonstration")} className="bg-transparent"><option value="lecture">Lecture / slides</option><option value="demonstration">Demonstration / motion</option></select></label>}
            {preflightReady && <span className="min-w-24 text-xs font-semibold text-muted">Mic <span className="ml-1 inline-block h-2 rounded bg-brand align-middle" style={{ width: `${Math.max(4, micLevel)}px` }}/></span>}
            {connectionId && (manager || participant?.audio_publish_allowed) && !published.some(value => value.kind === "microphone") && <Button variant="secondary" onClick={() => void enableGrantedMicrophone()}><Mic size={17}/>Enable microphone</Button>}
            {published.some(value => value.kind === "microphone") && <span className="inline-flex min-h-11 items-center gap-2 px-3 text-sm font-bold text-green-800"><Mic size={17}/>Microphone live</span>}
            {connectionId && (manager || (participant?.presenter && participant.screen_publish_allowed)) && <Button variant="secondary" onClick={() => void shareScreen()}><MonitorUp size={17}/>Share teaching screen</Button>}
            {!manager && <Button variant={participant?.raised_hand ? "primary" : "secondary"} onClick={() => void toggleHand()}><Hand size={17}/>{participant?.raised_hand ? "Lower hand" : "Raise hand"}</Button>}
            {!manager && connectionId && <Button variant="ghost" onClick={() => void toggleLowData()}>{lowData ? <Video size={17}/> : <VideoOff size={17}/>} {lowData ? "Restore visuals" : "Audio only"}</Button>}
          </div>
          <section className="card grid gap-3 p-4 sm:grid-cols-3 xl:grid-cols-6" aria-label="Connection measurements">
            <Metric label="Audio" value={`${stats.audioKbps.toFixed(0)} kbps`}/><Metric label="Video" value={`${stats.videoKbps.toFixed(0)} kbps`}/><Metric label="Screen" value={`${stats.screenKbps.toFixed(0)} kbps`}/><Metric label="Loss" value={`${stats.packetsLost}`}/><Metric label="RTT" value={stats.rttMs === null ? "—" : `${stats.rttMs.toFixed(0)} ms`}/><Metric label="Path" value={stats.candidateType || "—"}/>
          </section>
          {manager && <section className="card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold">Teacher-only presentation recording</h2><p className="mt-1 text-sm text-muted">Canvas-composed teaching visual plus Teacher microphone only. Classroom audio and chat are excluded.</p></div><span className="rounded-full bg-surface px-3 py-1 text-xs font-bold">{recordingStatus}</span></div>
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Share the teaching application or tab—not the classroom tab or a display containing private information. Browser storage improves recovery but is not an absolute durability guarantee.</p>
            <canvas ref={canvasRef} className="hidden"/>
            <div className="mt-4 flex flex-wrap gap-2"><Button disabled={recording || !preflightReady || !session.recording_enabled || !configuration.recordingEnabled || !configuration.r2Configured} onClick={() => void startRecording()}><Radio size={17}/>Start recording</Button><Button disabled={!recording} variant="secondary" onClick={() => recordingStopRef.current?.()}><PhoneOff size={17}/>Stop capture</Button><span className="inline-flex min-h-11 items-center text-sm tabular-nums text-muted">{(recordedBytes / 1048576).toFixed(1)} MiB uploaded</span></div>
            {(!configuration.recordingEnabled || !configuration.r2Configured) && <p className="mt-3 text-sm text-muted">Recording unavailable: {configuration.recordingEnabled ? `missing ${configuration.missingR2.join(", ")}` : "ALS_LIVE_RECORDING_ENABLED is disabled"}.</p>}
            {!!recoveries.length && <div className="mt-4 space-y-2"><div><h3 className="text-sm font-bold">Recoverable local segments</h3><p className="mt-1 text-xs text-muted">The local recovery copy is retained until the remote recording is reviewed and published.</p></div>{recoveries.map(recovery => <div key={recovery.segmentId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3 text-sm"><span>{recovery.title} · {recovery.status}</span><span className="flex gap-2">{recovery.status !== "validating" && <button className="min-h-11 px-3 font-bold text-brand" onClick={() => void resumeRecovery(recovery)}>Resume upload</button>}<button className="min-h-11 px-3 font-bold" onClick={() => void downloadRecoveredSegment(recovery.segmentId)}>Download</button></span></div>)}</div>}
            {!!recordings.length && <div className="mt-4 grid gap-2 sm:grid-cols-2">{recordings.map(value => <div className="rounded-lg bg-surface p-3 text-sm" key={value.id}><b className="capitalize">{value.status}</b><p className="mt-1 text-muted">{(value.total_bytes / 1048576).toFixed(1)} MiB {value.duration_seconds ? `· ${Math.round(value.duration_seconds)} seconds` : ""}</p>{value.error_message && <p className="mt-1 text-red-800">{value.error_message}</p>}</div>)}</div>}
          </section>}
        </section>
        <aside className="min-w-0 space-y-4">
          <section className="card flex min-h-[420px] flex-col p-4"><h2 className="font-bold">Class chat</h2><div className="my-4 max-h-[360px] flex-1 space-y-3 overflow-y-auto" aria-live="polite">{hasOlderMessages && <Button variant="ghost" className="w-full" disabled={loadingEarlierMessages} onClick={() => void loadEarlierMessages()}>{loadingEarlierMessages ? "Loading earlier messages…" : "Load earlier messages"}</Button>}{messages.map(value => <div key={value.id} className="rounded-lg bg-surface p-3"><b className="text-xs">{value.sender_name || "Participant"}</b><p className="mt-1 break-words text-sm">{value.body}</p></div>)}{!messages.length && <p className="text-sm text-muted">No class messages yet.</p>}</div><label className="text-xs font-bold text-muted">Message<textarea maxLength={4000} value={message} onChange={event => setMessage(event.target.value)} className="mt-1 min-h-20 w-full rounded-lg border border-line p-3 text-base font-normal text-ink"/></label><Button className="mt-2" onClick={() => void sendMessage()}>Send</Button></section>
          {manager && <section className="card p-4"><h2 className="font-bold">Hands and publishing grants</h2><div className="mt-3 space-y-3">{participants.filter(value => value.raised_hand || !value.left_at).map(value => <div key={value.user_id} className="rounded-lg border border-line p-3"><div className="flex items-center justify-between gap-2"><b className="text-sm">{value.full_name || "Student"}</b>{value.raised_hand && <Hand size={17} className="text-brand"/>}</div><div className="mt-2 grid grid-cols-2 gap-2"><button className="min-h-11 rounded-lg border px-2 text-xs font-bold" onClick={() => void changeGrant(value.user_id, "microphone", !value.audio_publish_allowed)}>{value.audio_publish_allowed ? <MicOff className="mx-auto" size={16}/> : <Mic className="mx-auto" size={16}/>} {value.audio_publish_allowed ? "Revoke mic" : "Grant mic"}</button><button className="min-h-11 rounded-lg border px-2 text-xs font-bold" onClick={() => void changeGrant(value.user_id, "presenter", !value.screen_publish_allowed)}>{value.screen_publish_allowed ? "Revoke screen" : "Grant screen"}</button></div><button className="mt-2 min-h-11 w-full rounded-lg text-xs font-bold text-red-700" onClick={() => void removeParticipant(value.user_id)}>Remove from class</button></div>)}{!participants.length && <p className="text-sm text-muted">No participants have joined.</p>}</div></section>}
        </aside>
      </div>
      <section className="card mt-5 p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-bold">Class polls</h2><p className="mt-1 text-sm text-muted">Responses are scoped to this class; answer keys are never included.</p></div>{manager && <div className="flex min-w-0 flex-1 gap-2 sm:max-w-xl"><select className="min-h-11 min-w-0 flex-1 rounded-lg border border-line px-3 text-sm" value={pollQuestion} onChange={event => setPollQuestion(event.target.value)}><option value="">Select an assigned question</option>{availableQuestions.map(question => <option key={question.id} value={question.id}>{question.prompt}</option>)}</select><Button disabled={!pollQuestion} onClick={() => void launchPoll()}>Launch</Button></div>}</div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">{polls.map(poll => { const own = poll.own_selected.length > 0; return <article key={poll.id} className="rounded-xl border border-line p-4"><div className="flex justify-between gap-3"><b>{poll.prompt || "Poll question"}</b><span className="text-xs font-bold text-muted">{poll.closed_at ? "Closed" : "Active"}</span></div><div className="mt-3 grid gap-2">{poll.options.map(option => <button key={option.id} disabled={manager || own || Boolean(poll.closed_at)} onClick={() => void answerPoll(poll.id, option.id)} className="min-h-11 rounded-lg border border-line px-3 text-left text-sm disabled:opacity-60">{option.content}</button>)}</div><p className="mt-2 text-xs text-muted">{own ? "Response received · " : ""}{manager || poll.show_results ? `${poll.response_count} responses` : "Results hidden"}</p>{manager && <div className="mt-3 flex flex-wrap gap-2">{!poll.closed_at && <button className="min-h-11 rounded-lg border border-line px-3 text-xs font-bold" onClick={() => void updatePoll(poll.id, { closed_at: new Date().toISOString() })}>Close poll</button>}<button className="min-h-11 rounded-lg border border-line px-3 text-xs font-bold" onClick={() => void updatePoll(poll.id, { show_results: !poll.show_results })}>{poll.show_results ? "Hide results" : "Release results"}</button></div>}</article>; })}{!polls.length && <p className="text-sm text-muted">No poll has been launched.</p>}</div>
      </section>
    </div>
  </div>;
}

function RemoteVideo({ stream, label }: { stream: MediaStream; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current) { ref.current.srcObject = stream; void ref.current.play().catch(() => undefined); } }, [stream]);
  return <video ref={ref} autoPlay playsInline className="h-full w-full object-contain" aria-label={label}/>;
}
function RemoteAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => { if (ref.current) { ref.current.srcObject = stream; void ref.current.play().catch(() => undefined); } }, [stream]);
  return <audio ref={ref} autoPlay/>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p><b className="mt-1 block truncate text-sm tabular-nums">{value}</b></div>;
}
