import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = process.env.ALS_LIVE_QA_SUPABASE_URL;
const anonKey = process.env.ALS_LIVE_QA_ANON_KEY;
const serviceRoleKey = process.env.ALS_LIVE_QA_SERVICE_ROLE_KEY;
const password = process.env.ALS_LIVE_QA_PASSWORD || "LocalQA!2026";

if (!url || !anonKey || !serviceRoleKey) {
  throw new Error("Set the ALS_LIVE_QA_SUPABASE_URL, ALS_LIVE_QA_ANON_KEY, and ALS_LIVE_QA_SERVICE_ROLE_KEY variables from the disposable local stack.");
}

const origin = new URL(url);
if (origin.protocol !== "http:" || origin.hostname !== "127.0.0.1" || origin.port !== "55321") {
  throw new Error(`Refusing non-disposable Supabase target: ${origin.origin}`);
}

const sessionId = "60000000-0000-0000-0000-000000000001";
const questionId = "80000000-0000-0000-0000-000000000001";
const pollId = "82000000-0000-0000-0000-000000000001";
const validOptionId = "81000000-0000-0000-0000-000000000001";
const student1Id = "10000000-0000-0000-0000-000000000011";
const student2Id = "10000000-0000-0000-0000-000000000012";

const identities = {
  admin: "admin@als-live-qa.invalid",
  assignedTeacher: "assigned-teacher@als-live-qa.invalid",
  unassignedTeacher: "unassigned-teacher@als-live-qa.invalid",
  student1: "student-1@als-live-qa.invalid",
  student2: "student-2@als-live-qa.invalid",
  suspended: "student-suspended@als-live-qa.invalid",
  inactive: "student-inactive@als-live-qa.invalid",
};

const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  realtime: { params: { eventsPerSecond: 20 } },
};

async function authenticated(email) {
  const client = createClient(url, anonKey, options);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  assert.ifError(error);
  assert.ok(data.user, `Expected a local Auth user for ${email}`);
  return client;
}

const clients = Object.fromEntries(await Promise.all(
  Object.entries(identities).map(async ([name, email]) => [name, await authenticated(email)]),
));
const service = createClient(url, serviceRoleKey, options);

const evidence = [];
const record = (name, details) => evidence.push({ name, ...details });

async function canJoin(name, expected) {
  const { data, error } = await clients[name].rpc("can_join_live", { target_session: sessionId });
  assert.ifError(error);
  assert.equal(data, expected, `${name} can_join_live`);
  record(`can_join:${name}`, { result: data });
}

await canJoin("admin", true);
await canJoin("assignedTeacher", true);
await canJoin("unassignedTeacher", false);
await canJoin("student1", true);
await canJoin("student2", true);
await canJoin("suspended", false);
await canJoin("inactive", false);

for (const name of ["admin", "assignedTeacher", "student1"]) {
  const { data, error } = await clients[name].rpc("live_session_payload", { target_session: sessionId });
  assert.ifError(error);
  assert.equal(data.length, 1);
  record(`session_payload:${name}`, { rows: data.length });
}

for (const name of ["unassignedTeacher", "suspended", "inactive"]) {
  const { data, error } = await clients[name].rpc("live_session_payload", { target_session: sessionId });
  assert.ifError(error);
  assert.deepEqual(data, []);
  record(`session_payload_denied:${name}`, { rows: data.length });
}

const ownProfile = await clients.student1.from("profiles").select("id,email");
assert.ifError(ownProfile.error);
assert.deepEqual(ownProfile.data.map(({ id }) => id), [student1Id]);
record("profiles_student_self_only", { rows: ownProfile.data.length });

const managerRoster = await clients.assignedTeacher.rpc("live_participant_roster", { target_session: sessionId });
assert.ifError(managerRoster.error);
assert.equal(managerRoster.data.length, 1);
const studentRoster = await clients.student1.rpc("live_participant_roster", { target_session: sessionId });
assert.ifError(studentRoster.error);
assert.deepEqual(studentRoster.data, []);
record("roster_scope", { managerRows: managerRoster.data.length, studentRows: studentRoster.data.length });

const connectionId = "61000000-0000-0000-0000-000000000001";
await service.from("live_media_connections").delete().eq("id", connectionId);
const selfConnection = await clients.student1.from("live_media_connections").insert({
  id: connectionId,
  session_id: sessionId,
  user_id: student1Id,
  provider_session_id: "synthetic-provider-session-student-1",
}).select("id").single();
assert.ifError(selfConnection.error);
const forgedConnection = await clients.student1.from("live_media_connections").insert({
  id: "61000000-0000-0000-0000-000000000002",
  session_id: sessionId,
  user_id: student2Id,
  provider_session_id: "synthetic-forged-provider-session",
});
assert.ok(forgedConnection.error, "Student must not create another user's connection");
record("connection_rls", { selfInsert: true, forgedInsertDenied: true });

const ownMessage = await clients.student1.from("live_messages").insert({
  session_id: sessionId,
  sender_id: student1Id,
  body: "Synthetic RLS message",
}).select("id").single();
assert.ifError(ownMessage.error);
const forgedMessage = await clients.student1.from("live_messages").insert({
  session_id: sessionId,
  sender_id: student2Id,
  body: "Synthetic forged sender",
});
assert.ok(forgedMessage.error, "Student must not forge a message sender");
record("message_rls", { selfInsert: true, forgedSenderDenied: true });

const invalidPoll = await clients.student2.from("live_question_responses").insert({
  live_question_id: pollId,
  student_id: student2Id,
  selected_option_ids: ["81000000-0000-0000-0000-000000000099"],
});
assert.ok(invalidPoll.error, "An option outside the poll question must be rejected");
const validPoll = await clients.student2.from("live_question_responses").insert({
  live_question_id: pollId,
  student_id: student2Id,
  selected_option_ids: [validOptionId],
}).select("live_question_id").single();
assert.ifError(validPoll.error);
const mutatePoll = await clients.student2.from("live_question_responses")
  .update({ selected_option_ids: ["81000000-0000-0000-0000-000000000002"] })
  .eq("live_question_id", pollId)
  .eq("student_id", student2Id)
  .select("live_question_id");
assert.ifError(mutatePoll.error);
assert.deepEqual(mutatePoll.data, [], "Poll responses are insert-only for students");
record("poll_rls", { invalidOptionDenied: true, validOptionAccepted: true, updateRows: mutatePoll.data.length });

const unassignedPoll = await clients.unassignedTeacher.from("live_questions").insert({
  id: "82000000-0000-0000-0000-000000000099",
  session_id: sessionId,
  question_id: questionId,
  launched_at: new Date().toISOString(),
  show_results: false,
});
assert.ok(unassignedPoll.error, "Unassigned Teacher must not launch a poll");
record("unassigned_teacher_poll_denied", { denied: true });

const studentRecording = await clients.student1.from("class_recordings").select("id,status").eq("session_id", sessionId);
assert.ifError(studentRecording.error);
assert.deepEqual(studentRecording.data, [], "Unpublished recordings must remain hidden from Students");
const teacherRecording = await clients.assignedTeacher.from("class_recordings").select("id,status").eq("session_id", sessionId);
assert.ifError(teacherRecording.error);
assert.equal(teacherRecording.data.length, 1);
record("recording_visibility", { studentRows: studentRecording.data.length, teacherRows: teacherRecording.data.length });

const removal = await clients.assignedTeacher.from("live_participants")
  .update({ removed_at: new Date().toISOString(), removed_by: "10000000-0000-0000-0000-000000000002" })
  .eq("session_id", sessionId)
  .eq("user_id", student1Id)
  .select("user_id")
  .single();
assert.ifError(removal.error);
await canJoin("student1", false);
const postRemovalMessages = await clients.student1.rpc("live_message_payload", { target_session: sessionId });
assert.ifError(postRemovalMessages.error);
assert.deepEqual(postRemovalMessages.data, []);
const postRemovalWrite = await clients.student1.from("live_messages").insert({
  session_id: sessionId,
  sender_id: student1Id,
  body: "Must be denied after removal",
});
assert.ok(postRemovalWrite.error);
record("removed_student_data_revocation", { payloadRows: 0, newWriteDenied: true });
const cleanupCandidates = await clients.assignedTeacher.rpc("live_transport_cleanup_candidates", { target_session: sessionId });
assert.ifError(cleanupCandidates.error);
assert.deepEqual(cleanupCandidates.data.map(value => value.connection_id), [connectionId]);
record("active_transport_revocation_candidate", { connectionId, reason: cleanupCandidates.data[0].reason });

const restore = await clients.assignedTeacher.from("live_participants")
  .update({ removed_at: null, removed_by: null })
  .eq("session_id", sessionId)
  .eq("user_id", student1Id);
assert.ifError(restore.error);
const restoredCandidates = await clients.assignedTeacher.rpc("live_transport_cleanup_candidates", { target_session: sessionId });
assert.ifError(restoredCandidates.error);
assert.deepEqual(restoredCandidates.data, []);

await service.from("live_media_connections").delete().eq("id", connectionId);
await service.from("live_messages").delete().eq("id", ownMessage.data.id);
await service.from("live_question_responses").delete().eq("live_question_id", pollId).eq("student_id", student2Id);

for (const client of Object.values(clients)) await client.auth.signOut();

console.log(JSON.stringify({
  target: origin.origin,
  fixtureDomain: "als-live-qa.invalid",
  authenticatedClients: Object.keys(clients).length,
  assertions: evidence.length,
  evidence,
}, null, 2));
