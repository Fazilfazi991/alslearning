import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = process.env.ALS_LIVE_QA_SUPABASE_URL;
const serviceRoleKey = process.env.ALS_LIVE_QA_SERVICE_ROLE_KEY;
const password = process.env.ALS_LIVE_QA_PASSWORD || "LocalQA!2026";
if (!url || !serviceRoleKey) throw new Error("Set the disposable local Supabase URL and service-role key.");
const origin = new URL(url);
if (origin.protocol !== "http:" || origin.hostname !== "127.0.0.1" || origin.port !== "55321") {
  throw new Error(`Refusing non-disposable Supabase target: ${origin.origin}`);
}

const service = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const users = [
  ["10000000-0000-0000-0000-000000000001", "admin@als-live-qa.invalid", "admin", "Synthetic Admin", true],
  ["10000000-0000-0000-0000-000000000002", "assigned-teacher@als-live-qa.invalid", "teacher", "Synthetic Assigned Teacher", true],
  ["10000000-0000-0000-0000-000000000003", "unassigned-teacher@als-live-qa.invalid", "teacher", "Synthetic Unassigned Teacher", true],
  ...[1, 2, 3, 4, 5].map(number => [`10000000-0000-0000-0000-00000000001${number}`, `student-${number}@als-live-qa.invalid`, "student", `Synthetic Student ${number}`, true]),
  ["10000000-0000-0000-0000-000000000021", "student-suspended@als-live-qa.invalid", "student", "Synthetic Suspended Student", true],
  ["10000000-0000-0000-0000-000000000022", "student-inactive@als-live-qa.invalid", "student", "Synthetic Inactive Student", false],
];

for (const [id, email, , fullName] of users) {
  const { error } = await service.auth.admin.createUser({ id, email, password, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error && !/already|registered|exists/i.test(error.message)) throw error;
}

async function upsert(table, rows, onConflict = "id") {
  const { error } = await service.from(table).upsert(rows, { onConflict });
  assert.ifError(error);
}

await upsert("profiles", users.map(([id, email, role, full_name, is_active]) => ({ id, email, role, full_name, is_active })));
const programId = "20000000-0000-0000-0000-000000000001";
const subjectId = "30000000-0000-0000-0000-000000000001";
const batchId = "40000000-0000-0000-0000-000000000001";
const teacherId = "10000000-0000-0000-0000-000000000002";
const sessionId = "60000000-0000-0000-0000-000000000001";
const now = Date.now();
const yesterday = new Date(now - 86_400_000).toISOString();
const nextMonth = new Date(now + 30 * 86_400_000).toISOString();

await upsert("programs", { id: programId, slug: "als-live-qa-program", name: "Synthetic Live QA Program", status: "active", has_live_classes: true });
await upsert("subjects", { id: subjectId, slug: "als-live-qa-subject", name: "Synthetic Laboratory Science", status: "active" });
await upsert("program_subjects", { program_id: programId, subject_id: subjectId }, "program_id,subject_id");
await upsert("batches", { id: batchId, program_id: programId, slug: "als-live-qa-batch", name: "Synthetic Live QA Batch", status: "active", access_starts_at: yesterday, access_expires_at: nextMonth });
await upsert("faculty_assignments", { id: "50000000-0000-0000-0000-000000000001", faculty_id: teacherId, program_id: programId, subject_id: subjectId, can_manage_content: true, can_manage_questions: true, can_manage_tests: true });
await upsert("batch_faculty", { batch_id: batchId, faculty_id: teacherId }, "batch_id,faculty_id");

const enrolledStudents = [11, 12, 13, 14, 15, 21, 22];
await upsert("enrollments", enrolledStudents.map(number => ({
  id: `90000000-0000-0000-0000-0000000000${number}`,
  student_id: `10000000-0000-0000-0000-0000000000${number}`,
  program_id: programId,
  batch_id: batchId,
  access_starts_at: yesterday,
  access_expires_at: nextMonth,
  status: number === 21 ? "suspended" : "active",
})));
await upsert("live_sessions", {
  id: sessionId, program_id: programId, batch_id: batchId, subject_id: subjectId, faculty_id: teacherId,
  title: "Synthetic restricted Cloudflare POC", starts_at: new Date(now - 15 * 60_000).toISOString(),
  ends_at: new Date(now + 2 * 60 * 60_000).toISOString(), provider: "cloudflare-poc", status: "live",
  chat_enabled: true, student_audio_enabled: false, student_video_enabled: false, recording_enabled: true,
});
await upsert("live_participants", {
  session_id: sessionId, user_id: "10000000-0000-0000-0000-000000000011", joined_at: new Date(now - 5 * 60_000).toISOString(),
  presence_started_at: new Date(now - 5 * 60_000).toISOString(),
}, "session_id,user_id");

const questionId = "80000000-0000-0000-0000-000000000001";
await upsert("questions", {
  id: questionId, program_id: programId, subject_id: subjectId, type: "single_mcq",
  prompt: "Synthetic poll: which specimen tube is appropriate?", difficulty: "medium", marks: 1,
  negative_marks: 0, source_type: "standard", status: "active", created_by: teacherId,
});
await upsert("question_options", [
  { id: "81000000-0000-0000-0000-000000000001", question_id: questionId, label: "A", content: "Synthetic option A", display_order: 1 },
  { id: "81000000-0000-0000-0000-000000000002", question_id: questionId, label: "B", content: "Synthetic option B", display_order: 2 },
]);
await upsert("live_questions", {
  id: "82000000-0000-0000-0000-000000000001", session_id: sessionId, question_id: questionId,
  launched_at: new Date().toISOString(), show_results: false,
});
await upsert("class_recordings", {
  id: "70000000-0000-0000-0000-000000000001", session_id: sessionId, owner_id: teacherId,
  status: "ready", total_bytes: 0,
});

console.log(JSON.stringify({ target: origin.origin, fixtureDomain: "als-live-qa.invalid", users: users.length, sessionId }, null, 2));
