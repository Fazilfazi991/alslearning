import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "../.local-qa/playwright/node_modules/playwright/index.mjs";
import { createClient } from "@supabase/supabase-js";

const projectRef = "xstssknlgdraulebdsfd";
const base = process.env.QA_APP_URL || "http://localhost:3007";
const videoPath = "C:/Users/User/Videos/ALS Migration/99e6a06b-a64e-43cd-be4c-686f070246ef/delivery/video.mp4";
const canonicalKey = "recorded-classes/573ecbcc-05d7-4212-8b50-fbdb7463af37/delivery/video.mp4";
const fixture = JSON.parse(fs.readFileSync(".local-qa/recorded-classes-auth.json", "utf8"));
const fileSize = fs.statSync(videoPath).size;
assert.ok(fileSize > 250 * 1024 * 1024);
const keysResponse = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/api-keys`, { headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` } });
assert.equal(keysResponse.ok, true);
const serviceKey = (await keysResponse.json()).find(key => key.name === "service_role")?.api_key;
const service = createClient(fixture.url, serviceKey, { auth: { persistSession: false } });
const title = `QA ONLY — Admin workflow ${Date.now()}`;
const report = { base, fileSize, sizeMiB: Number((fileSize / 1024 / 1024).toFixed(1)), title, recordingId: null, partAttempts: 0, networkRetryRecovered: false, progressVisible: false, savedAfterUpload: false, metadata: null, interactionTimestamp: null, interactionSaved: false, publishedAndPreviewed: false, cleanup: false };
let recordingId = null;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

try {
  await page.goto(`${base}/login`);
  await page.getByRole("textbox", { name: "Email address", exact: true }).fill(fixture.users.admin.email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/admin");
  await page.goto(`${base}/admin/recorded-classes`);
  await page.getByRole("button", { name: "Add recording", exact: true }).click();
  await page.getByLabel("Playback source").selectOption("native");
  await page.getByLabel("Subject *").selectOption({ label: "Biochemistry" });
  const topic = page.getByLabel("Topic *");
  await page.waitForFunction(() => document.querySelectorAll('select[required]')[1]?.options.length > 1);
  await topic.selectOption({ index: 1 });
  await page.getByLabel("Video title *").fill(title);
  await page.getByRole("button", { name: "Save recording", exact: true }).click();
  await page.getByText("Recording saved.", { exact: true }).waitFor();
  const created = await service.from("recorded_classes").select("id").eq("title", title).single();
  assert.ifError(created.error); recordingId = created.data.id; report.recordingId = recordingId;
  await page.locator("article").filter({ hasText: title }).getByRole("button", { name: "Edit", exact: true }).click();

  const fakeKey = `recorded-classes/${recordingId}/qa-workflow/video.mp4`;
  await page.route(url => url.pathname === `/api/admin/recorded-classes/${recordingId}/upload`, async route => {
    const body = route.request().postDataJSON();
    if (body.action === "begin") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ uploadId: "qa-workflow", objectKey: fakeKey, partSize: 16 * 1024 * 1024 }) });
    if (body.action === "sign") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: `https://qa-upload.invalid/part/${body.partNumber}` }) });
    if (body.action === "complete") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ objectKey: fakeKey, fileSize }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ aborted: true }) });
  });
  let failOnce = true;
  await page.route(url => url.hostname === "qa-upload.invalid", async route => {
    report.partAttempts += 1;
    if (failOnce) { failOnce = false; report.networkRetryRecovered = true; return route.abort("failed"); }
    return route.fulfill({ status: 200, headers: { ETag: `"qa-part-${report.partAttempts}"`, "Access-Control-Allow-Origin": new URL(base).origin, "Access-Control-Expose-Headers": "ETag" }, body: "" });
  });
  await page.locator('input[type="file"]').setInputFiles(videoPath);
  await page.getByText(/Uploading directly to R2/).waitFor(); report.progressVisible = true;
  await page.getByText("Upload complete. Save the recording to attach this private video.", { exact: true }).waitFor({ timeout: 120000 });
  assert.equal(report.partAttempts, Math.ceil(fileSize / (16 * 1024 * 1024)) + 1);
  await page.getByRole("button", { name: "Save recording", exact: true }).click();
  await page.getByText("Recording saved.", { exact: true }).waitFor();
  const afterUpload = await service.from("recorded_classes").select("storage_key,file_size,width,height,duration_seconds").eq("id", recordingId).single();
  assert.ifError(afterUpload.error);
  assert.equal(afterUpload.data.storage_key, fakeKey);
  assert.equal(Number(afterUpload.data.file_size), fileSize);
  report.savedAfterUpload = true;

  const canonical = await service.from("recorded_classes").select("mime_type,file_size,width,height,duration_seconds,checksum_sha256").eq("id", "573ecbcc-05d7-4212-8b50-fbdb7463af37").single();
  assert.ifError(canonical.error);
  const attached = await service.from("recorded_classes").update({ storage_key: canonicalKey, ...canonical.data }).eq("id", recordingId);
  assert.ifError(attached.error);
  await page.reload();
  await page.locator("article").filter({ hasText: title }).getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByText("Preview and timestamp interactions", { exact: true }).click();
  const video = page.getByLabel(`${title} Admin preview`);
  await video.waitFor();
  await page.waitForFunction(label => Array.from(document.querySelectorAll("video")).some(item => item.getAttribute("aria-label") === label && item.readyState >= 1), `${title} Admin preview`);
  report.metadata = await video.evaluate(item => ({ duration: item.duration, width: item.videoWidth, height: item.videoHeight, controls: item.controls, playsInline: item.playsInline }));
  assert.equal(report.metadata.width, 1920); assert.equal(report.metadata.height, 1080);
  await video.evaluate(item => { item.currentTime = 42; });
  await page.getByRole("button", { name: "+ Add question here", exact: true }).click();
  report.interactionTimestamp = Number(await page.getByLabel("Time (seconds)").inputValue());
  assert.equal(report.interactionTimestamp, 42);
  await page.getByLabel("Question").fill("QA FIXTURE — Admin timestamp authoring works.");
  await page.getByRole("textbox", { name: "Option 1", exact: true }).fill("First"); await page.getByRole("textbox", { name: "Option 2", exact: true }).fill("Second");
  await page.getByLabel("Correct answer").selectOption("1");
  await page.getByRole("textbox", { name: "Explanation", exact: true }).fill("Disposable Admin authoring fixture.");
  await page.getByLabel("Allow retry").check();
  await page.getByRole("button", { name: "Save interaction", exact: true }).click();
  await page.getByText("Interaction saved.", { exact: true }).waitFor();
  report.interactionSaved = true;
  await page.screenshot({ path: ".local-qa/r2/admin-native-authoring-1440.png", fullPage: true });

  await page.getByLabel("Status").first().selectOption("published");
  await page.getByRole("button", { name: "Save recording", exact: true }).click();
  await page.getByText("Recording saved.", { exact: true }).waitFor();
  const article = page.locator("article").filter({ hasText: title });
  await article.getByRole("button", { name: "Preview", exact: true }).click();
  const publishedPreview = article.locator("video");
  await publishedPreview.waitFor();
  await page.waitForFunction(() => Array.from(document.querySelectorAll("article video")).some(item => item.readyState >= 1));
  report.publishedAndPreviewed = true;
  await page.screenshot({ path: ".local-qa/r2/admin-native-published-1440.png", fullPage: true });
} finally {
  if (recordingId) await service.from("recorded_classes").delete().eq("id", recordingId);
  report.cleanup = recordingId ? !(await service.from("recorded_classes").select("id").eq("id", recordingId).maybeSingle()).data : true;
  await context.close(); await browser.close();
  fs.writeFileSync(".local-qa/r2/admin-workflow-qa.json", JSON.stringify(report, null, 2));
}

assert.equal(report.networkRetryRecovered, true);
assert.equal(report.savedAfterUpload, true);
assert.equal(report.interactionSaved, true);
assert.equal(report.publishedAndPreviewed, true);
assert.equal(report.cleanup, true);
console.log(JSON.stringify(report, null, 2));
