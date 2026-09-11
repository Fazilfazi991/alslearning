// Uses the existing QA fixtures; rejected calls only, no content mutations.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { clients, ok } from "./pathology-client.mjs";
const { login, fixture } = await clients();
const student = await login("second"),
  teacher = await login("teacher");
const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } },
);
const checks = [];
for (const name of ["is_admin", "is_teacher"]) {
  const result = await anon.rpc(name);
  assert.ok(result.error, `anon ${name} denied`);
  checks.push(`anon ${name} denied`);
}
for (const [role, db] of [
  ["student", student],
  ["teacher", teacher],
  ["anon", anon],
]) {
  for (const [rpc, args] of [
    ["core_save_question", { value: {} }],
    ["core_save_test", { value: {}, question_ids: [], batch_ids: [] }],
    [
      "core_program_subjects",
      { target_program: fixture.program.id, subject_ids: [] },
    ],
  ]) {
    const result = await db.rpc(rpc, args);
    assert.ok(result.error, `${role} ${rpc} denied`);
    assert.match(
      result.error.message,
      /permission|denied|not authorized|forbidden|admin|privilege|faculty/i,
      `${role} must fail authorization, not merely validation`,
    );
    checks.push(`${role} ${rpc} unauthorized mutation denied`);
  }
}
for (const table of [
  "questions",
  "question_answer_keys",
  "test_attempts",
  "attempt_answers",
]) {
  const result = await anon.from(table).select("*").limit(1);
  assert.ok(result.error || ok(result).length === 0, `anon ${table} protected`);
  checks.push(`anon ${table} protected`);
}
writeFileSync(
  ".local-qa/helper-grants/role-regression.json",
  JSON.stringify({ checks }, null, 2),
);
console.log(`PASS ${checks.length} explicit role/privileged RPC checks`);
