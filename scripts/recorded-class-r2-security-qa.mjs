import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "../.local-qa/playwright/node_modules/playwright/index.mjs";
import { createClient } from "@supabase/supabase-js";

const projectRef = "xstssknlgdraulebdsfd";
const recordingId = "573ecbcc-05d7-4212-8b50-fbdb7463af37";
const base = process.env.QA_APP_URL || "http://localhost:3007";
const fixture = JSON.parse(fs.readFileSync(".local-qa/recorded-classes-auth.json", "utf8"));
assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname, `${projectRef}.supabase.co`);
assert.ok(process.env.SUPABASE_ACCESS_TOKEN, "SUPABASE_ACCESS_TOKEN is required");

const keyResponse = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/api-keys`, {
  headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` },
});
assert.equal(keyResponse.ok, true, "Could not resolve QA API keys");
const keys = await keyResponse.json();
const serviceKey = keys.find(key => key.name === "service_role")?.api_key;
assert.ok(serviceKey, "QA service credential unavailable");
const service = createClient(fixture.url, serviceKey, { auth: { persistSession: false } });
const studentDb = createClient(fixture.url, fixture.anon, { auth: { persistSession: false } });
const signedIn = await studentDb.auth.signInWithPassword({ email: fixture.users.student.email, password: fixture.password });
assert.ifError(signedIn.error);

const ok = result => { if (result.error) throw result.error; return result.data; };
const report = { base, checks: [], statuses: {} };
const pass = (name, condition = true) => { assert.ok(condition, name); report.checks.push(name); };
const browser = await chromium.launch({ channel: "chrome", headless: true });

async function loggedInPage(role) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${base}/login`);
  await page.getByRole("textbox", { name: "Email address", exact: true }).fill(fixture.users[role].email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(role === "admin" ? "**/admin" : role === "student" ? "**/student" : "**/teacher");
  return { context, page };
}

const enrollment = ok(await service.from("enrollments").select("*").eq("student_id", fixture.users.student.id).eq("program_id", fixture.program).single());
const programSubjects = ok(await service.from("program_subjects").select("*").eq("program_id", fixture.program).order("display_order"));
const recording = ok(await service.from("recorded_classes").select("subject_id").eq("id", recordingId).single());
assert.ok(programSubjects.some(row => row.subject_id === recording.subject_id));

try {
  const teacher = await loggedInPage("teacher");
  const teacherStatus = await teacher.page.evaluate(async id => (await fetch(`/api/recorded-classes/${id}/playback`)).status, recordingId);
  report.statuses.teacherPlayback = teacherStatus;
  pass("Teacher cannot resolve Student playback", teacherStatus === 403);
  await teacher.context.close();

  const student = await loggedInPage("student");
  const allowed = await student.page.evaluate(async id => {
    const response = await fetch(`/api/recorded-classes/${id}/playback`);
    const body = await response.json();
    return { status: response.status, body };
  }, recordingId);
  report.statuses.authorizedStudentPlayback = allowed.status;
  pass("Authorized Student receives temporary delivery URL", allowed.status === 200 && /X-Amz-Expires=14400/.test(allowed.body.playbackUrl));
  pass("Student playback payload excludes answer keys", !JSON.stringify(allowed.body).includes("correct_option"));
  pass("Student playback payload excludes source object", !JSON.stringify(allowed.body).includes("source/original"));

  const uploadDenied = await student.page.evaluate(async id => (await fetch(`/api/admin/recorded-classes/${id}/upload`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "begin", fileName: "blocked.mp4", contentType: "video/mp4", fileSize: 1024 }),
  })).status, recordingId);
  report.statuses.studentUpload = uploadDenied;
  pass("Student cannot authorize an R2 upload", uploadDenied === 403);

  const interactionWrite = await studentDb.from("recorded_class_interactions").insert({
    recorded_class_id: recordingId, timestamp_seconds: 1, question: "Unauthorized", options: ["A", "B"], correct_option: 0,
  });
  pass("Student cannot create interactions", Boolean(interactionWrite.error));
  const overwrite = await studentDb.from("recorded_classes").update({ title: "Unauthorized" }).eq("id", recordingId).select("id");
  pass("Student cannot overwrite recording metadata", Boolean(overwrite.error) || overwrite.data.length === 0);
  const remove = await studentDb.from("recorded_classes").delete().eq("id", recordingId).select("id");
  pass("Student cannot delete recordings", Boolean(remove.error) || remove.data.length === 0);

  await service.from("program_subjects").delete().eq("program_id", fixture.program).eq("subject_id", recording.subject_id);
  const crossSubject = await student.page.evaluate(async id => (await fetch(`/api/recorded-classes/${id}/playback`, { cache: "no-store" })).status, recordingId);
  report.statuses.crossSubjectPlayback = crossSubject;
  pass("Cross-subject Student cannot resolve playback", [403, 404].includes(crossSubject));
  await service.from("program_subjects").insert(programSubjects.find(row => row.subject_id === recording.subject_id));

  await service.from("enrollments").update({ access_starts_at: new Date(Date.now() - 172800000).toISOString(), access_expires_at: new Date(Date.now() - 86400000).toISOString() }).eq("id", enrollment.id);
  const expired = await student.page.evaluate(async id => (await fetch(`/api/recorded-classes/${id}/playback`, { cache: "no-store" })).status, recordingId);
  report.statuses.expiredEnrollmentPlayback = expired;
  pass("Expired enrollment cannot resolve playback", [403, 404].includes(expired));
  await service.from("enrollments").update({ access_starts_at: enrollment.access_starts_at, access_expires_at: enrollment.access_expires_at, status: enrollment.status }).eq("id", enrollment.id);
  await student.context.close();

  const admin = await loggedInPage("admin");
  const csrf = await admin.page.request.post(`${base}/api/admin/recorded-classes/${recordingId}/upload`, {
    headers: { Origin: "https://attacker.invalid", "Content-Type": "application/json" },
    data: { action: "begin", fileName: "blocked.mp4", contentType: "video/mp4", fileSize: 1024 },
  });
  report.statuses.crossOriginAdminUpload = csrf.status();
  pass("Cross-origin Admin upload authorization is rejected", csrf.status() === 403);

  const uploadSession = await admin.page.evaluate(async id => {
    const endpoint = `/api/admin/recorded-classes/${id}/upload`;
    const begin = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "begin", fileName: "qa-abort.mp4", contentType: "video/mp4", fileSize: 1024 }) });
    const session = await begin.json();
    const abort = begin.ok ? await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "abort", ...session }) }) : null;
    return { begin: begin.status, abort: abort?.status ?? null, objectKey: session.objectKey ?? "" };
  }, recordingId);
  report.statuses.adminUploadBegin = uploadSession.begin;
  report.statuses.adminUploadAbort = uploadSession.abort;
  pass("Admin can authorize a private multipart upload", uploadSession.begin === 200 && uploadSession.objectKey.startsWith(`recorded-classes/${recordingId}/`));
  pass("Admin can abort a multipart upload", uploadSession.abort === 200);
  await admin.context.close();

  pass("R2 credentials are server-only", !Object.keys(process.env).some(key => key.startsWith("NEXT_PUBLIC_R2")));
  report.passed = report.checks.length;
  fs.writeFileSync(".local-qa/r2/security-qa.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await service.from("program_subjects").delete().eq("program_id", fixture.program);
  if (programSubjects.length) await service.from("program_subjects").insert(programSubjects);
  await service.from("enrollments").update({ access_starts_at: enrollment.access_starts_at, access_expires_at: enrollment.access_expires_at, status: enrollment.status }).eq("id", enrollment.id);
  await studentDb.auth.signOut({ scope: "local" });
  await browser.close();
}
