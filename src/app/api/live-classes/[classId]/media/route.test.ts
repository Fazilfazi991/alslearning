import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(), authorize: vi.fn(), getIceServers: vi.fn(() => []),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/live-class/config", () => ({ assertLiveFeature: () => ({ realtimeConfigured: true, turnConfigured: false }) }));
vi.mock("@/lib/live-class/authorization", () => ({
  authorizeLiveClass: mocks.authorize, assertClassroomMode: () => undefined,
  LiveAuthorizationError: class LiveAuthorizationError extends Error {
    constructor(message: string, readonly status = 403) { super(message); }
  },
}));
vi.mock("@/lib/live-class/provider", () => ({ getIceServers: mocks.getIceServers, cloudflareRealtime: {} }));
vi.mock("@/lib/request-origin", () => ({ isSameOriginRequest: () => true }));
vi.mock("@/lib/live-class/rate-limit", () => ({ consumeLiveRateLimit: () => ({ allowed: true }) }));
vi.mock("@/lib/live-class/staging-window", () => ({ stagingTestWindowOpen: () => true }));
vi.mock("@/lib/live-class/transport-cleanup", () => ({ closeProviderTracks: vi.fn() }));

import { POST } from "./route";

const classId = "60000000-0000-0000-0000-000000000001";
const teacherId = "10000000-0000-0000-0000-000000000002";
const studentId = "10000000-0000-0000-0000-000000000011";

function database(receiverCount: number) {
  const countQuery = {
    eq: vi.fn(), in: vi.fn(), neq: vi.fn(), then: (resolve: (value: unknown) => unknown) =>
      resolve({ count: receiverCount, error: null }),
  };
  countQuery.eq.mockReturnValue(countQuery);
  countQuery.in.mockReturnValue(countQuery);
  countQuery.neq.mockReturnValue(countQuery);
  const priorQuery = {
    eq: vi.fn(), in: vi.fn(), maybeSingle: vi.fn(async () => ({ data: null, error: null })),
  };
  priorQuery.eq.mockReturnValue(priorQuery);
  priorQuery.in.mockReturnValue(priorQuery);
  const insert = vi.fn(async () => ({ error: null }));
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: studentId } } }) },
    from: vi.fn((table: string) => ({
      select: (_columns: string, options?: { count?: string }) => {
        if (table !== "live_media_connections") throw new Error(`Unexpected select: ${table}`);
        return options?.count ? countQuery : priorQuery;
      },
      insert,
    })),
    rpc: vi.fn(async () => ({ error: null })),
  };
  return { db, countQuery, insert };
}

const create = () => POST(
  new Request(`https://staging.example/api/live-classes/${classId}/media`, {
    method: "POST", body: JSON.stringify({ action: "create", mode: "classroom" }),
  }),
  { params: Promise.resolve({ classId }) } as never,
);

describe("live media receiver limit", () => {
  beforeEach(() => {
    mocks.authorize.mockReset();
    mocks.createClient.mockReset();
    mocks.authorize.mockResolvedValue({ role: "student", session: { faculty_id: teacherId, max_receivers: 1 } });
  });

  it("allows the first Student after Teacher joined a one receiver class", async () => {
    const { db, countQuery, insert } = database(0);
    mocks.createClient.mockResolvedValue(db);
    const response = await create();
    expect(response.status).toBe(200);
    expect(countQuery.neq).toHaveBeenCalledWith("user_id", teacherId);
    expect(insert).toHaveBeenCalled();
  });

  it("rejects a second Student once the receiver slot is occupied", async () => {
    const { db, insert } = database(1);
    mocks.createClient.mockResolvedValue(db);
    const response = await create();
    expect(response.status).toBe(409);
    expect(insert).not.toHaveBeenCalled();
  });

  it("does not charge the Teacher against receiver capacity", async () => {
    const { db, countQuery } = database(1);
    mocks.createClient.mockResolvedValue(db);
    mocks.authorize.mockResolvedValue({ role: "teacher", session: { faculty_id: teacherId, max_receivers: 1 } });
    const response = await create();
    expect(response.status).toBe(200);
    expect(countQuery.neq).not.toHaveBeenCalled();
  });
});
