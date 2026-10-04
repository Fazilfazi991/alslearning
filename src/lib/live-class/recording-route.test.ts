import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/live-classes/[classId]/recordings/route";

const mocks = vi.hoisted(() => ({ database: null as unknown, digest: vi.fn(), playback: vi.fn(), begin: vi.fn(), sign: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => mocks.database }));
vi.mock("@/lib/live-class/rate-limit", () => ({ consumeLiveRateLimit: () => ({ allowed: true }) }));
vi.mock("@/lib/live-class/staging-window", () => ({ stagingTestWindowOpen: () => true }));
vi.mock("@/lib/live-class/recording-storage", () => ({ r2RecordingStorage: {
  digest: mocks.digest, playbackUrl: mocks.playback, begin: mocks.begin, signPart: mocks.sign,
} }));

type Row = Record<string, unknown>;
const classId = "7385751c-3640-4db3-9a45-5348e682cffe";
const recordingId = "ea83d954-a4ef-45b6-b34c-8b80722f3b04";
const segmentId = "5d65817a-2a15-4013-9504-f81f8ece728c";
const checksum = "a".repeat(64);
let rows: Record<string, Row[]>;
let userId: string;

function query(table: string) {
  const filters: ((row: Row) => boolean)[] = [];
  let mutation: Row | undefined;
  const execute = () => {
    const selected = (rows[table] || []).filter(row => filters.every(filter => filter(row)));
    if (mutation) selected.forEach(row => Object.assign(row, mutation));
    return { data: selected, error: null };
  };
  const chain = {
    select: () => chain,
    eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return chain; },
    in: (key: string, values: unknown[]) => { filters.push(row => values.includes(row[key])); return chain; },
    order: () => chain,
    update: (value: Row) => { mutation = value; return chain; },
    single: async () => ({ data: execute().data[0] || null, error: null }),
    maybeSingle: async () => ({ data: execute().data[0] || null, error: null }),
    then: (resolve: (value: ReturnType<typeof execute>) => unknown) => Promise.resolve(execute()).then(resolve),
  };
  return chain;
}

const context = () => ({ params: Promise.resolve({ classId }) });
const post = (action: string, extra: Row = {}) => POST(new Request(`https://als.test/api/live-classes/${classId}/recordings`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, mode: "classroom", recordingId, ...extra }),
}), context());
const get = (review = false) => GET(new Request(`https://als.test/api/live-classes/${classId}/recordings?recordingId=${recordingId}${review ? "&review=1" : ""}`), context());
const recording = () => rows.class_recordings[0];
const segment = () => rows.live_recording_segments[0];
function identity(role: string) { userId = role; }
async function approveAndPublish() {
  expect((await post("review")).status).toBe(200);
  expect((await post("publish")).status).toBe(200);
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const name of ["ALS_LIVE_CLASS_ENABLED", "ALS_LIVE_RECORDING_ENABLED", "ALS_LIVE_POC_ENABLED"]) vi.stubEnv(name, "false");
  for (const name of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]) vi.stubEnv(name, "unit-test-only");
  identity("admin");
  const end = new Date(Date.now() - 60_000).toISOString();
  rows = {
    profiles: ["admin", "teacher", "student"].map(role => ({ id: role, role, is_active: true })),
    live_sessions: [{ id: classId, faculty_id: "teacher", program_id: "program", batch_id: "batch", subject_id: "subject", status: "completed", ended_at: end, recording_enabled: true, provider: "cloudflare" }],
    enrollments: [{ id: "enrollment", student_id: "student", program_id: "program", batch_id: "batch", status: "active", access_expires_at: null, access_starts_at: null }],
    class_recordings: [{ id: recordingId, session_id: classId, owner_id: "teacher", status: "validating", client_validated_at: end, verified_at: null, published_at: null }],
    live_recording_segments: [{ id: segmentId, recording_id: recordingId, session_id: classId, owner_id: "teacher", status: "validating", object_key: "existing-private-object", total_bytes: 4451838, object_sha256: checksum, client_validated_at: end, client_reported_duration_seconds: 184.958, started_at: new Date(Date.now() - 120_000).toISOString(), completed_at: end }],
  };
  mocks.database = { from: query, auth: { getUser: async () => ({ data: { user: { id: userId } } }) }, rpc: async () => ({ data: true, error: null }) };
  mocks.digest.mockResolvedValue({ byteLength: 4451838, sha256: checksum });
  mocks.playback.mockImplementation(async () => ({ url: `https://storage.invalid/unit-test-${mocks.playback.mock.calls.length}`, expiresAt: "unit-test" }));
});

describe("recording route with capture entry disabled", () => {
  it("denies new capture even with an open operational window and live class", async () => {
    identity("teacher"); rows.live_sessions[0].status = "live";
    const response = await post("begin", { contentType: "video/webm" });
    expect(response.status).not.toBe(200);
    expect(await response.json()).toEqual({ error: "Live-class recording is disabled" });
    expect(mocks.begin).not.toHaveBeenCalled();
  });
  it("also enforces the classroom entry gate when recording alone is enabled", async () => {
    vi.stubEnv("ALS_LIVE_RECORDING_ENABLED", "true");
    expect(await (await post("begin")).json()).toEqual({ error: "Normal live-class entry is disabled" });
    expect(mocks.begin).not.toHaveBeenCalled();
  });
  it("allows genuine Admin preview, canonical approval and publication of validated media", async () => {
    expect((await get(true)).status).toBe(200);
    await approveAndPublish();
    expect(recording()).toMatchObject({ status: "published", duration_seconds: 184.958, published_by: "admin" });
    expect(recording().verified_at).toBeTruthy(); expect(recording().published_at).toBeTruthy();
    expect(segment()).toMatchObject({ status: "ready", object_key: "existing-private-object", object_sha256: checksum });
    expect(mocks.digest).toHaveBeenCalledWith("existing-private-object");
  });
  it("denies Student playback before publication and permits playback and fresh renewal afterward", async () => {
    identity("student"); expect((await get()).status).toBe(403);
    expect(mocks.playback).not.toHaveBeenCalled();
    identity("admin"); await approveAndPublish(); identity("student");
    const first = await get(); const second = await get();
    expect(first.status).toBe(200); expect(second.status).toBe(200);
    expect((await first.json()).segments[0].url).not.toBe((await second.json()).segments[0].url);
  });
  it.each(["expired", "missing", "wrong-scope"])("denies %s Student even after publication", async kind => {
    await approveAndPublish(); identity("student");
    if (kind === "expired") rows.enrollments[0].access_expires_at = new Date(Date.now() - 1).toISOString();
    if (kind === "missing") rows.enrollments = [];
    if (kind === "wrong-scope") rows.enrollments[0].program_id = "another-program";
    expect((await get()).status).toBe(403); expect(mocks.playback).not.toHaveBeenCalled();
  });
  it.each(["student", "teacher"])("denies %s Admin approval/publication", async role => {
    identity(role);
    expect((await post("review")).status).toBe(403);
    recording().status = "ready"; recording().verified_at = new Date().toISOString();
    expect((await post("publish")).status).toBe(403);
    expect(mocks.digest).not.toHaveBeenCalled();
  });
  it.each(["uploading", "interrupted", "aborted", "failed"])("denies approval and publication of %s media", async status => {
    recording().status = status; segment().status = status;
    expect((await post("review")).status).toBe(409);
    expect((await post("publish")).status).toBe(409);
    expect(mocks.digest).not.toHaveBeenCalled();
  });
  it.each(["missing-evidence", "wrong-class", "unknown-recording", "digest-mismatch", "bytes-mismatch", "aborted-segment"])("fails closed for %s", async kind => {
    if (kind === "missing-evidence") segment().client_validated_at = null;
    if (kind === "wrong-class") recording().session_id = "another-class";
    if (kind === "unknown-recording") recording().id = "another-recording";
    if (kind === "digest-mismatch") mocks.digest.mockResolvedValue({ byteLength: 4451838, sha256: "b".repeat(64) });
    if (kind === "bytes-mismatch") mocks.digest.mockResolvedValue({ byteLength: 1, sha256: checksum });
    if (kind === "aborted-segment") segment().status = "aborted";
    expect((await post("review")).status).toBe(409);
    expect(recording().verified_at).toBeNull(); expect(recording().published_at).toBeNull();
    expect((await post("publish")).status).toBe(409);
  });
  it("permits existing assigned Teacher validation after shutdown within the recovery window", async () => {
    identity("teacher"); segment().client_validated_at = null;
    expect((await post("validate", { segmentId, fullSha256: checksum, durationSeconds: 184.958, seekable: true, hasAudio: true, hasVideo: true })).status).toBe(200);
    expect(segment().client_validated_at).toBeTruthy(); expect(recording().status).toBe("validating");
  });
  it.each(["missing-segment", "wrong-owner", "expired-recovery"])("does not authorize fresh/invalid upload work (%s)", async kind => {
    identity("teacher");
    if (kind === "missing-segment") rows.live_recording_segments = [];
    if (kind === "wrong-owner") segment().owner_id = "another-teacher";
    if (kind === "expired-recovery") rows.live_sessions[0].ended_at = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    expect((await post("sign", { segmentId, partNumber: 1, byteLength: 10, sha256: checksum })).status).not.toBe(200);
    expect(mocks.sign).not.toHaveBeenCalled();
  });
});
