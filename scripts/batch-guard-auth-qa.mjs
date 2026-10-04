// Authenticated acceptance against a disposable, marked local Supabase stack.
// Run with an ignored env file supplied by the local database executor. This
// intentionally leaves synthetic fixtures for the separate browser check.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const project = process.env.ALS_BATCH_GUARD_PROJECT;
const marker = process.env.ALS_BATCH_GUARD_MARKER;
const containerId = process.env.ALS_BATCH_GUARD_CONTAINER_ID;
const dbPort = process.env.ALS_BATCH_GUARD_DB_PORT;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.ALS_BATCH_GUARD_PASSWORD;
const fixturePath = process.env.ALS_BATCH_GUARD_FIXTURE_PATH;
assert.match(project || "", /^als_batch_guard_[0-9]+$/);
assert.match(marker || "", /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
assert.match(containerId || "", /^[0-9a-f]{64}$/);
assert.match(dbPort || "", /^563[0-9]{2}$/);
assert.ok(anonKey && serviceKey && password && fixturePath);
const api = new URL(url);
assert.equal(api.protocol, "http:");
assert.equal(api.hostname, "127.0.0.1");
assert.match(api.port, /^563[0-9]{2}$/);

const docker = JSON.parse(execFileSync("docker.exe", ["inspect", containerId], { encoding: "utf8" }))[0];
assert.equal(docker.Id, containerId);
assert.equal(docker.Name, `/supabase_db_${project}`);
assert.equal(docker.Config.Labels["com.docker.compose.project"], project);
assert.equal(docker.State.Running, true);
assert.equal(docker.State.Health?.Status, "healthy");
const dbMappings = docker.NetworkSettings.Ports["5432/tcp"];
assert.ok(dbMappings?.length);
assert.ok(dbMappings.every(x => x.HostPort === dbPort));
const siblingIds = execFileSync("docker.exe", ["ps", "-q", "--filter",
  `label=com.docker.compose.project=${project}`], { encoding: "utf8" }).trim().split(/\s+/);
const siblings = JSON.parse(execFileSync("docker.exe", ["inspect", ...siblingIds], { encoding: "utf8" }));
const component = name => {
  const found = siblings.find(x => x.Name === `/supabase_${name}_${project}`);
  assert.ok(found, `Missing disposable ${name} container`);
  assert.equal(found.Config.Labels["com.docker.compose.project"], project);
  assert.equal(found.State.Running, true);
  assert.ok(Object.keys(found.NetworkSettings.Networks).some(network => network in docker.NetworkSettings.Networks));
  return found;
};
const gateway = component("kong");
component("rest");
component("auth");
const apiMappings = gateway.NetworkSettings.Ports["8000/tcp"];
assert.ok(apiMappings?.length);
assert.ok(apiMappings.every(x => x.HostPort === api.port));
const comment = execFileSync("docker.exe", ["exec", "-u", "postgres", containerId,
  "psql", "-X", "-w", "-qAt", "-d", "postgres", "-c",
  "select current_database() || '|' || coalesce(shobj_description((select oid from pg_database where datname=current_database()), 'pg_database'),'')"],
{ encoding: "utf8" }).trim();
assert.equal(comment, `postgres|als-batch-guard:${marker}:${project}`);

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const service = createClient(url, serviceKey, options);
const runId = randomUUID().replaceAll("-", "");
const email = role => `${role}-${runId}@als-batch-guard.invalid`;
const users = {};
for (const role of ["admin", "teacher", "student", "wrongStudent"]) {
  const { data, error } = await service.auth.admin.createUser({
    email: email(role), password, email_confirm: true,
    user_metadata: { full_name: `Synthetic ${role}` },
  });
  assert.ifError(error);
  users[role] = { id: data.user.id, email: email(role) };
  if (role === "admin") {
    assert.match(data.user.id, /^[0-9a-f-]{36}$/);
    const authId = execFileSync("docker.exe", ["exec", "-u", "postgres", containerId,
      "psql", "-X", "-w", "-qAt", "-v", "ON_ERROR_STOP=1", "-d", "postgres", "-c",
      `select id from auth.users where id = '${data.user.id}'`], { encoding: "utf8" }).trim();
    assert.equal(authId, data.user.id, "Local Auth must write to the marked database");
    const restProfile = await service.from("profiles").select("id").eq("id", data.user.id).single();
    assert.ifError(restProfile.error);
    assert.equal(restProfile.data.id, authId, "Local Data API must read the same profile");
  }
  const { error: roleError } = await service.from("profiles").update({
    role: role === "wrongStudent" ? "student" : role,
  }).eq("id", data.user.id);
  assert.ifError(roleError);
}

async function signIn(role) {
  const client = createClient(url, anonKey, options);
  const { data, error } = await client.auth.signInWithPassword({ email: users[role].email, password });
  assert.ifError(error);
  assert.equal(data.user.id, users[role].id);
  return client;
}
const clients = Object.fromEntries(await Promise.all(
  Object.keys(users).map(async role => [role, await signIn(role)]),
));
async function insert(client, table, value) {
  const { data, error } = await client.from(table).insert(value).select().single();
  assert.ifError(error);
  return data;
}
async function rows(client, table, ids) {
  const { data, error } = await client.from(table).select("*").in("id", ids);
  assert.ifError(error);
  return data;
}

const ids = Object.fromEntries(["programA", "programB", "batchA", "batchWrong",
  "batchB", "contentA", "contentWrong", "contentB", "enrollmentA", "enrollmentWrong",
  "enrollmentB"].map(key => [key, randomUUID()]));
const slug = key => `batch-guard-${runId}-${key}`;
for (const [key, name] of [["programA", "Program A"], ["programB", "Program B"]]) {
  await insert(clients.admin, "programs", { id: ids[key], slug: slug(key), name: `Synthetic ${name}`, status: "active" });
}
for (const [key, program] of [["batchA", "programA"], ["batchWrong", "programA"], ["batchB", "programB"]]) {
  await insert(clients.admin, "batches", { id: ids[key], program_id: ids[program], slug: slug(key), name: `Synthetic ${key}`, status: "active" });
}
await insert(clients.admin, "faculty_assignments", {
  faculty_id: users.teacher.id, program_id: ids.programA,
  can_manage_content: true, can_manage_tests: true,
});
const faculty = await clients.admin.from("batch_faculty").insert({
  batch_id: ids.batchA, faculty_id: users.teacher.id,
});
assert.ifError(faculty.error);
await insert(clients.admin, "enrollments", {
  id: ids.enrollmentA, student_id: users.student.id, program_id: ids.programA,
  batch_id: ids.batchA, status: "active", access_starts_at: new Date(Date.now() - 60000).toISOString(),
});
await insert(clients.admin, "enrollments", {
  id: ids.enrollmentWrong, student_id: users.wrongStudent.id, program_id: ids.programA,
  batch_id: ids.batchWrong, status: "active", access_starts_at: new Date(Date.now() - 60000).toISOString(),
});
for (const [content, program, batch] of [["contentA", "programA", "batchA"],
  ["contentWrong", "programA", "batchWrong"], ["contentB", "programB", "batchB"]]) {
  await insert(service, "learning_content", {
    id: ids[content], kind: "note", slug: slug(content), title: `Synthetic ${content}`,
    program_id: ids[program], status: "active",
  });
  const { error } = await service.from("content_batch_access").insert({
    content_id: ids[content], batch_id: ids[batch],
  });
  assert.ifError(error);
}
async function visibleContent(client) {
  const { data, error } = await client.from("learning_content").select("id")
    .in("id", [ids.contentA, ids.contentWrong, ids.contentB]);
  assert.ifError(error);
  return data.map(x => x.id).sort();
}
assert.deepEqual(await visibleContent(clients.student), [ids.contentA]);
assert.deepEqual(await visibleContent(clients.wrongStudent), [ids.contentWrong]);

const directDelete = await clients.admin.from("batches").delete().eq("id", ids.batchA).select("id");
assert.equal(directDelete.error?.code, "23503", "Admin direct delete must hit a foreign key");
assert.match(directDelete.error.message, /_batch_id_fkey/);
for (const role of ["teacher", "student"]) {
  const visible = await clients[role].from("batches").select("id").eq("id", ids.batchA);
  assert.ifError(visible.error);
  assert.equal(visible.data.length, 1, `${role} must see the batch before deletion attempt`);
  const denied = await clients[role].from("batches").delete().eq("id", ids.batchA).select("id");
  assert.notEqual(denied.error?.code, "23503", `${role} denial must come from RLS or authorization`);
  if (denied.error) assert.match(denied.error.code || "", /^(42501|PGRST\d+)$/);
  else assert.equal(denied.data.length, 0, `${role} deletion must affect zero rows`);
  assert.equal((await rows(service, "batches", [ids.batchA])).length, 1);
}
assert.equal((await rows(service, "enrollments", [ids.enrollmentA]))[0].batch_id, ids.batchA);
assert.deepEqual(await visibleContent(clients.student), [ids.contentA]);

for (const [status, shouldSee] of [["archived", false], ["upcoming", false], ["active", true]]) {
  const changed = await clients.admin.from("batches").update({ status }).eq("id", ids.batchA).select("status").single();
  assert.ifError(changed.error);
  assert.equal(changed.data.status, status);
  assert.equal((await visibleContent(clients.student)).includes(ids.contentA), shouldSee);
}

await insert(clients.admin, "enrollments", {
  id: ids.enrollmentB, student_id: users.student.id, program_id: ids.programB,
  batch_id: ids.batchB, status: "active", access_starts_at: new Date(Date.now() - 60000).toISOString(),
});
const bothBefore = await rows(service, "enrollments", [ids.enrollmentA, ids.enrollmentB]);
assert.equal(bothBefore.length, 2);
assert.equal(new Set(bothBefore.map(x => x.program_id)).size, 2);
const BBefore = bothBefore.find(x => x.id === ids.enrollmentB);
const expiry = new Date(Date.now() + 20 * 86400000).toISOString();
const edit = await clients.admin.from("enrollments").update({ access_expires_at: expiry })
  .eq("id", ids.enrollmentA).select("id,access_expires_at").single();
assert.ifError(edit.error);
assert.equal(edit.data.id, ids.enrollmentA);
const bothAfter = await rows(service, "enrollments", [ids.enrollmentA, ids.enrollmentB]);
assert.equal(bothAfter.find(x => x.id === ids.enrollmentB).access_expires_at, BBefore.access_expires_at);
assert.equal(new Date(bothAfter.find(x => x.id === ids.enrollmentA).access_expires_at).getTime(), new Date(expiry).getTime());
const own = await clients.student.from("enrollments").select("id,program_id").eq("student_id", users.student.id);
assert.ifError(own.error);
assert.deepEqual(own.data.map(x => x.program_id).sort(), [ids.programA, ids.programB].sort());
assert.deepEqual(await visibleContent(clients.student), [ids.contentA, ids.contentB].sort());

const fixture = { project, marker, runId, ids, users, apiUrl: api.origin };
writeFileSync(fixturePath, JSON.stringify(fixture, null, 2), { flag: "wx", mode: 0o600 });
console.log(JSON.stringify({ project, runId, adminDirectDelete: { code: directDelete.error.code,
  message: directDelete.error.message }, teacherStudentDeleteDenied: true,
  wrongBatchDenied: true, directApiStateGate: true, enrollmentRows: bothAfter.length,
  programIds: [ids.programA, ids.programB], browserFixturePath: fixturePath }, null, 2));
