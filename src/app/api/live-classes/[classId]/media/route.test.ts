import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(), authorize: vi.fn(), getIceServers: vi.fn(() => []), mayPublish: vi.fn(() => true),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/live-class/config", () => ({ assertLiveFeature: () => ({ realtimeConfigured: true, turnConfigured: false }) }));
vi.mock("@/lib/live-class/authorization", () => ({
  authorizeLiveClass: mocks.authorize, assertClassroomMode: () => undefined, mayPublish: mocks.mayPublish,
  LiveAuthorizationError: class LiveAuthorizationError extends Error {
    constructor(message: string, readonly status = 403) { super(message); }
  },
}));
vi.mock("@/lib/live-class/provider", () => ({ getIceServers: mocks.getIceServers, cloudflareRealtime: {} }));
vi.mock("@/lib/request-origin", () => ({ isSameOriginRequest: () => true }));
vi.mock("@/lib/live-class/rate-limit", () => ({ consumeLiveRateLimit: () => ({ allowed: true }) }));
vi.mock("@/lib/live-class/staging-window", () => ({ stagingTestWindowOpen: () => true }));
vi.mock("@/lib/live-class/transport-cleanup", () => ({ closeProviderTracks: vi.fn() }));

import { GET, POST } from "./route";
import { LiveAuthorizationError } from "@/lib/live-class/authorization";

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

describe("publication readiness ownership", () => {
  const connectionId = "70000000-0000-0000-0000-000000000001";
  const trackId = "80000000-0000-0000-0000-000000000001";
  beforeEach(() => {
    mocks.authorize.mockResolvedValue({ role: "student", session: { status: "live" } });
    mocks.mayPublish.mockReturnValue(true);
  });
  function setup(tracks: object[]) {
    const scope = {
      eq: vi.fn(), in: vi.fn(), order: vi.fn(),
      maybeSingle: vi.fn(async () => ({ data: { id: connectionId, status: "active" } })),
      then: (resolve: (value: unknown) => unknown) => resolve({ data: tracks, error: null }),
    };
    scope.eq.mockReturnValue(scope); scope.in.mockReturnValue(scope); scope.order.mockReturnValue(scope);
    const update = vi.fn(() => scope);
    mocks.createClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: studentId } } }) },
      from: () => ({ select: () => scope, update }),
    });
    return { scope, update };
  }
  const ready = () => POST(new Request(`https://production.example/api/live-classes/${classId}/media`, {
    method: "POST", body: JSON.stringify({ action: "ready", mode: "classroom", connectionId, trackIds: [trackId] }),
  }), { params: Promise.resolve({ classId }) } as never);

  it("only announces active publications belonging to the authenticated connection and class", async () => {
    const { scope, update } = setup([{ id: trackId, kind: "microphone" }]);
    expect((await ready()).status).toBe(200);
    expect(scope.eq).toHaveBeenCalledWith("session_id", classId);
    expect(scope.eq).toHaveBeenCalledWith("connection_id", connectionId);
    expect(scope.eq).toHaveBeenCalledWith("owner_id", studentId);
    expect(scope.eq).toHaveBeenCalledWith("status", "active");
    expect(update).toHaveBeenCalledWith({ discovery_ready: true });
  });

  it("does not announce someone else's or a closed publication", async () => {
    const { update } = setup([]);
    expect((await ready()).status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it("rechecks a Student's current microphone grant", async () => {
    const { update } = setup([{ id: trackId, kind: "microphone" }]);
    mocks.mayPublish.mockReturnValue(false);
    expect((await ready()).status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it("excludes negotiating publications from discovery", async () => {
    const { scope } = setup([]);
    const response = await GET(new Request(`https://production.example/api/live-classes/${classId}/media?mode=classroom`), { params: Promise.resolve({ classId }) } as never);
    expect(response.status).toBe(200);
    expect(scope.eq).toHaveBeenCalledWith("discovery_ready", true);
  });
});

describe("requests arriving after Teacher End", () => {
  const connectionId = "70000000-0000-0000-0000-000000000001";
  beforeEach(() => {
    mocks.authorize.mockReset();
    mocks.createClient.mockReset();
    mocks.authorize.mockResolvedValue({ role: "student", session: { status: "completed" } });
  });
  const late = (action: string) => POST(new Request(`https://production.example/api/live-classes/${classId}/media`, {
    method: "POST", body: JSON.stringify({ action, mode: "classroom", connectionId }),
  }), { params: Promise.resolve({ classId }) } as never);

  it("returns terminal discovery without opening or querying media tracks", async () => {
    const { db } = database(0);
    mocks.createClient.mockResolvedValue(db);
    const response = await GET(new Request(`https://production.example/api/live-classes/${classId}/media?mode=classroom`),
      { params: Promise.resolve({ classId }) } as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ tracks: [], status: "completed" });
    expect(db.from).not.toHaveBeenCalled();
  });

  it.each(["heartbeat", "leave"])("acknowledges a late %s only for the owned connection without reviving it", async action => {
    const { db, insert } = database(0);
    const scoped = { eq: vi.fn(), maybeSingle: vi.fn(async () => ({ data: { id: connectionId, status: "closed" } })) };
    scoped.eq.mockReturnValue(scoped);
    db.from.mockReturnValue({ select: () => scoped, insert } as never);
    mocks.createClient.mockResolvedValue(db);
    const response = await late(action);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ alive: false, status: "completed" });
    expect(scoped.eq).toHaveBeenCalledWith("user_id", studentId);
    expect(scoped.eq).toHaveBeenCalledWith("session_id", classId);
    expect(db.rpc).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a late leave for an unowned connection", async () => {
    const { db } = database(0);
    mocks.createClient.mockResolvedValue(db);
    expect((await late("leave")).status).toBe(403);
  });

  it.each(["stale", "closed"])("acknowledges an owned %s connection heartbeat while the class remains live", async status => {
    const { db, insert } = database(0);
    const scoped = { eq: vi.fn(), maybeSingle: vi.fn(async () => ({ data: { id: connectionId, status } })) };
    scoped.eq.mockReturnValue(scoped);
    db.from.mockReturnValue({ select: () => scoped, insert } as never);
    mocks.createClient.mockResolvedValue(db);
    mocks.authorize.mockResolvedValue({ role: "student", session: { status: "live" } });
    const response = await late("heartbeat");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ alive: false, status: "live" });
    expect(scoped.eq).toHaveBeenCalledWith("user_id", studentId);
    expect(scoped.eq).toHaveBeenCalledWith("session_id", classId);
    expect(db.rpc).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("acknowledges a repeated owned leave without changing presence for a replacement connection", async () => {
    const { db } = database(0);
    const scoped = { eq: vi.fn(), maybeSingle: vi.fn(async () => ({ data: { id: connectionId, status: "closed" } })) };
    scoped.eq.mockReturnValue(scoped);
    db.from.mockReturnValue({ select: () => scoped } as never);
    mocks.createClient.mockResolvedValue(db);
    mocks.authorize.mockResolvedValue({ role: "student", session: { status: "live" } });
    expect((await late("leave")).status).toBe(200);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it.each(["heartbeat", "publish"])("does not permit %s against an unowned or closed publication connection", async action => {
    const { db } = database(0);
    if (action === "publish") {
      const scoped = { eq: vi.fn(), maybeSingle: vi.fn(async () => ({ data: { id: connectionId, status: "stale" } })) };
      scoped.eq.mockReturnValue(scoped);
      db.from.mockReturnValue({ select: () => scoped } as never);
    }
    mocks.createClient.mockResolvedValue(db);
    mocks.authorize.mockResolvedValue({ role: "student", session: { status: "live" } });
    expect((await late(action)).status).toBe(403);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("still requires connect authorization for a new connection after End", async () => {
    const { db, insert } = database(0);
    mocks.createClient.mockResolvedValue(db);
    mocks.authorize.mockImplementation(async (_db, _user, _class, purpose) => {
      if (purpose === "connect") throw new LiveAuthorizationError("The class is not live", 409);
      return { role: "student", session: { status: "completed" } };
    });
    expect((await create()).status).toBe(409);
    expect(insert).not.toHaveBeenCalled();
  });
});
