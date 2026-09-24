import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = process.env.ALS_LIVE_QA_SUPABASE_URL;
const anonKey = process.env.ALS_LIVE_QA_ANON_KEY;
const serviceRoleKey = process.env.ALS_LIVE_QA_SERVICE_ROLE_KEY;
const password = process.env.ALS_LIVE_QA_PASSWORD || "LocalQA!2026";
if (!url || !anonKey || !serviceRoleKey) throw new Error("Set disposable local Supabase credentials.");
const origin = new URL(url);
if (origin.protocol !== "http:" || origin.hostname !== "127.0.0.1" || origin.port !== "55321") throw new Error(`Refusing target ${origin.origin}`);

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const student = createClient(url, anonKey, options);
const service = createClient(url, serviceRoleKey, options);
const { error: signInError } = await student.auth.signInWithPassword({ email: "student-2@als-live-qa.invalid", password });
assert.ifError(signInError);
const sessionId = "60000000-0000-0000-0000-000000000001";
const senderId = "10000000-0000-0000-0000-000000000002";
const marker = "[volume-qa]";
const rows = Array.from({ length: 200 }, (_, index) => ({ session_id: sessionId, sender_id: senderId, body: `${marker} ${String(index + 1).padStart(3, "0")} synthetic chat payload for authenticated measurement` }));
const inserted = await service.from("live_messages").insert(rows).select("id");
assert.ifError(inserted.error);

try {
  const oldPayload = await student.rpc("live_message_payload", { target_session: sessionId });
  assert.ifError(oldPayload.error);
  const firstPage = await student.rpc("live_message_page", { target_session: sessionId, before_created_at: null, before_id: null, page_size: 50 });
  assert.ifError(firstPage.error);
  assert.equal(firstPage.data.length, 50);
  const bytes = value => Buffer.byteLength(JSON.stringify(value), "utf8");
  console.log(JSON.stringify({
    target: origin.origin,
    authenticatedAs: "student-2@als-live-qa.invalid",
    historyRows: 200,
    before: { rpc: "live_message_payload", rows: oldPayload.data.length, responseJsonBytes: bytes(oldPayload.data), bounded: false },
    after: { rpc: "live_message_page", rows: firstPage.data.length, responseJsonBytes: bytes(firstPage.data), bounded: true, maximumRows: 100, requestedRows: 50 },
  }, null, 2));
} finally {
  await service.from("live_messages").delete().in("id", inserted.data.map(row => row.id));
  await student.auth.signOut();
}
