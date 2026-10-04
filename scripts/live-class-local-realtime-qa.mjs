import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = process.env.ALS_LIVE_QA_SUPABASE_URL;
const anonKey = process.env.ALS_LIVE_QA_ANON_KEY;
const password = process.env.ALS_LIVE_QA_PASSWORD || "LocalQA!2026";
if (!url || !anonKey) throw new Error("Set the disposable local Supabase URL and anon key.");
const origin = new URL(url);
if (origin.protocol !== "http:" || origin.hostname !== "127.0.0.1" || origin.port !== "55321") {
  throw new Error(`Refusing non-disposable Supabase target: ${origin.origin}`);
}

const sessionId = "60000000-0000-0000-0000-000000000001";
const studentId = "10000000-0000-0000-0000-000000000011";
const teacherId = "10000000-0000-0000-0000-000000000002";
const topic = `class:${sessionId}`;
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function signedIn(email) {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  assert.ifError(error);
  assert.ok(data.session?.access_token);
  return { client, accessToken: data.session.access_token };
}

function subscribe(channel, timeoutMs = 8_000) {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve({ status: "TIMEOUT", error: null }), timeoutMs);
    channel.subscribe((status, error) => {
      if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        clearTimeout(timer);
        resolve({ status, error: error?.message || null });
      }
    });
  });
}

const student = await signedIn("student-1@als-live-qa.invalid");
const teacher = await signedIn("assigned-teacher@als-live-qa.invalid");
const suspended = await signedIn("student-suspended@als-live-qa.invalid");
let receivedBeforeRemoval = 0;
let receivedAfterRemoval = 0;
let cachedBroadcastAfterRemoval = 0;
let removed = false;

const studentChannel = student.client.channel(topic, { config: { private: true, broadcast: { ack: true, self: true } } })
  .on("broadcast", { event: "qa-sensitive" }, () => {
    if (removed) cachedBroadcastAfterRemoval += 1;
  })
  .on("postgres_changes", {
    event: "INSERT", schema: "public", table: "live_messages", filter: `session_id=eq.${sessionId}`,
  }, payload => {
    if (payload.new?.body === "Synthetic realtime before removal") receivedBeforeRemoval += 1;
    if (payload.new?.body === "Synthetic realtime after removal") receivedAfterRemoval += 1;
  });
const teacherChannel = teacher.client.channel(topic, { config: { private: true, broadcast: { ack: true, self: true } } });
const suspendedChannel = suspended.client.channel(topic, { config: { private: true, broadcast: { ack: true } } });

let studentStatus;
let teacherStatus;
let suspendedStatus;
let cachedSendResult = null;
try {
  [studentStatus, teacherStatus, suspendedStatus] = await Promise.all([
    subscribe(studentChannel), subscribe(teacherChannel), subscribe(suspendedChannel),
  ]);
  assert.equal(studentStatus.status, "SUBSCRIBED");
  assert.equal(teacherStatus.status, "SUBSCRIBED");
  assert.notEqual(suspendedStatus.status, "SUBSCRIBED", "Ineligible client must not join the private classroom topic");

  const before = await teacher.client.from("live_messages").insert({
    session_id: sessionId,
    sender_id: teacherId,
    body: "Synthetic realtime before removal",
  }).select("id").single();
  assert.ifError(before.error);
  await sleep(1_500);
  assert.equal(receivedBeforeRemoval, 1, "Eligible established client should receive an authorized Postgres change");

  const removal = await teacher.client.from("live_participants").update({
    removed_at: new Date().toISOString(),
    removed_by: teacherId,
  }).eq("session_id", sessionId).eq("user_id", studentId).select("user_id").single();
  assert.ifError(removal.error);
  removed = true;

  const after = await teacher.client.from("live_messages").insert({
    session_id: sessionId,
    sender_id: teacherId,
    body: "Synthetic realtime after removal",
  }).select("id").single();
  assert.ifError(after.error);
  await teacherChannel.send({ type: "broadcast", event: "qa-sensitive", payload: { synthetic: true } });
  await sleep(1_500);
  assert.equal(receivedAfterRemoval, 0, "Removed client must not receive subsequent RLS-protected chat rows");

  cachedSendResult = await studentChannel.send({ type: "broadcast", event: "qa-sensitive", payload: { synthetic: true } });

  const rejoin = student.client.channel(topic, { config: { private: true, broadcast: { ack: true } } });
  const rejoinStatus = await subscribe(rejoin);
  assert.notEqual(rejoinStatus.status, "SUBSCRIBED", "Removed client must fail a fresh private-channel authorization check");
  await student.client.removeChannel(rejoin);

  await teacher.client.from("live_messages").delete().in("id", [before.data.id, after.data.id]);
} finally {
  await teacher.client.from("live_participants").update({ removed_at: null, removed_by: null })
    .eq("session_id", sessionId).eq("user_id", studentId);
  await Promise.all([
    student.client.removeAllChannels(),
    teacher.client.removeAllChannels(),
    suspended.client.removeAllChannels(),
  ]);
  student.client.realtime.disconnect();
  teacher.client.realtime.disconnect();
  suspended.client.realtime.disconnect();
  await Promise.all([student.client.auth.signOut(), teacher.client.auth.signOut(), suspended.client.auth.signOut()]);
}

console.log(JSON.stringify({
  target: origin.origin,
  privateJoin: {
    eligibleStudent: studentStatus.status,
    assignedTeacher: teacherStatus.status,
    suspendedStudent: suspendedStatus.status,
  },
  postgresChanges: {
    beforeRemoval: receivedBeforeRemoval,
    afterRemoval: receivedAfterRemoval,
  },
  cachedBroadcastAuthorization: {
    receivedAfterRemoval: cachedBroadcastAfterRemoval,
    removedClientSendResult: cachedSendResult,
    note: "Broadcast/Presence policy access is cached for the WebSocket connection; ALS classroom state uses RLS-protected Postgres Changes, not Broadcast payloads.",
  },
}, null, 2));
process.exit(0);
