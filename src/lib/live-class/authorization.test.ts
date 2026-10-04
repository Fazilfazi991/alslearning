import { describe, expect, it } from "vitest";
import { authorizeLiveClass, LiveAuthorizationError, mayPublish } from "./authorization";

const session = {
  id: "class-1", faculty_id: "teacher-1", program_id: "program-1", batch_id: "batch-1", subject_id: "subject-1",
  status: "live", starts_at: new Date(Date.now() - 60_000).toISOString(), ends_at: new Date(Date.now() + 60_000).toISOString(),
  join_opens_at: new Date(Date.now() - 60_000).toISOString(), join_closes_at: new Date(Date.now() + 60_000).toISOString(),
  recording_enabled: true, provider: "cloudflare",
  max_receivers: 50,
};

function database(profile: Record<string, unknown>, enrollment: Record<string, unknown> | null = null, assigned = true) {
  return {
    from(table: string) {
      return { select() {
        const filter = {
          eq() { return filter; },
          single: async () => ({ data: table === "profiles" ? profile : table === "live_sessions" ? session : enrollment, error: null }),
          maybeSingle: async () => ({ data: enrollment, error: null }),
        };
        return filter;
      } };
    },
    rpc: async () => ({ data: assigned, error: null }),
  };
}

describe("authorizeLiveClass", () => {
  it("rejects inactive application profiles", async () => {
    await expect(authorizeLiveClass(database({ id: "student-1", role: "student", is_active: false }), "student-1", session.id, "view"))
      .rejects.toEqual(expect.objectContaining({ status: 401 }));
  });

  it("rejects an unassigned Teacher even when a Teacher login exists", async () => {
    await expect(authorizeLiveClass(database({ id: "teacher-1", role: "teacher", is_active: true }, null, false), "teacher-1", session.id, "manage"))
      .rejects.toBeInstanceOf(LiveAuthorizationError);
  });

  it.each([
    ["suspended", null, null],
    ["active", new Date(Date.now() + 60_000).toISOString(), null],
    ["active", null, new Date(Date.now() - 60_000).toISOString()],
  ])("rejects an ineligible enrollment (%s)", async (status, access_starts_at, access_expires_at) => {
    const enrollment = { status, access_starts_at, access_expires_at, program_id: "program-1", batch_id: "batch-1" };
    await expect(authorizeLiveClass(database({ id: "student-1", role: "student", is_active: true }, enrollment), "student-1", session.id, "connect"))
      .rejects.toBeInstanceOf(LiveAuthorizationError);
  });

  it("accepts a current scoped Student enrollment", async () => {
    const value = await authorizeLiveClass(database({ id: "student-1", role: "student", is_active: true }, { status: "active", access_starts_at: null, access_expires_at: null }), "student-1", session.id, "connect");
    expect(value.role).toBe("student");
  });
});

describe("mayPublish", () => {
  const student = { role: "student" as const, isClassManager: false };
  it("keeps microphone and presenter grants independent", () => {
    expect(mayPublish(student, { audio_publish_allowed: true }, "microphone")).toBe(true);
    expect(mayPublish(student, { audio_publish_allowed: true }, "camera")).toBe(false);
    expect(mayPublish(student, { presenter: true, screen_publish_allowed: false }, "screen")).toBe(false);
    expect(mayPublish(student, { presenter: true, screen_publish_allowed: true }, "screen")).toBe(true);
  });
  it("blocks revoked republishing", () => expect(mayPublish(student, { audio_publish_allowed: false }, "microphone")).toBe(false));
});
