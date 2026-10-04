import { act, create, type ReactTestRenderer, type ReactTestInstance } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NativeClassroom } from "./native-classroom";

const mocks = vi.hoisted(() => ({ row: { id: "class", status: "live", updated_at: "2026-10-03T00:00:00Z" },
  channels: [] as { handlers: { table: string; callback: (payload: { new: Record<string, unknown> }) => void }[]; subscribed?: (state: string) => void }[],
  reads: vi.fn(), fetch: vi.fn(), stop: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({
  channel: () => {
    const state = { handlers: [] } as typeof mocks.channels[number]; mocks.channels.push(state);
    const channel = { on: (_event: string, filter: { table: string }, callback: typeof state.handlers[number]["callback"]) => {
      state.handlers.push({ table: filter.table, callback }); return channel;
    }, subscribe: (callback?: (state: string) => void) => { state.subscribed = callback; return channel; } };
    return channel;
  }, removeChannel: vi.fn(), rpc: async () => ({ data: [], error: null }),
  from: () => { const query = { select: () => query, eq: () => query,
    maybeSingle: async () => { mocks.reads(); return { data: { ...mocks.row }, error: null }; } }; return query; },
}) }));
vi.mock("@/lib/live-class/recording-store", () => ({ listRecordingRecoveries: async () => [],
  acquireRecordingOwnership: vi.fn(), deleteRecordingRecovery: vi.fn(), downloadRecoveredSegment: vi.fn(),
  listRecordingChunks: vi.fn(), saveRecordingChunk: vi.fn(), saveRecordingRecovery: vi.fn() }));
vi.mock("@/lib/live-class/receive-negotiation", () => ({ acceptReceiveOffer: async (peer: FakePeer,
  _value: unknown, map: Map<string, unknown>) => {
  map.set("0", { id: "mic", kind: "microphone", ownerId: "teacher" });
  peer.ontrack?.({ transceiver: { mid: "0" }, track: { id: "remote-mic", stop: mocks.stop } });
} }));
vi.mock("next/link", () => ({ default: (props: Record<string, unknown>) => <a {...props} /> }));

class FakePeer {
  static all: FakePeer[] = [];
  connectionState = "connected";
  ontrack: ((event: { transceiver: { mid: string }; track: { id: string; stop: () => void } }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  constructor() { FakePeer.all.push(this); }
  close() { this.connectionState = "closed"; }
  getReceivers() { return [{ track: { stop: mocks.stop } }]; }
}
class FakeStream { constructor(private tracks: unknown[] = []) {} getTracks() { return this.tracks; } }
let renderer: ReactTestRenderer;
let browser: EventTarget;
let documentEvents: EventTarget;
const props = (role: "student" | "teacher" = "student") => ({
  session: { id: "class", title: "Synthetic class", faculty_id: "teacher", status: "live", starts_at: null, ends_at: null,
    recording_enabled: false, programs: null, subjects: null, batches: null, profiles: null },
  user: { id: role, role, full_name: role, email: null }, participant: null, participants: [],
  initialMessages: [], initialPolls: [], availableQuestions: [], recordings: [],
  configuration: { realtimeConfigured: true, r2Configured: false, turnConfigured: true, recordingEnabled: false, forceRelay: false,
    pocInterruptUploadPart: null, pocUploadRecoveryDelayMs: 0, pocMotionOverlay: false, pocMaxRecordingSeconds: null,
    pocHoldFinalUpload: false, missingRealtime: [], missingR2: [], missingTurn: [] },
  entryEnabled: true, testingWindow: { opensAt: null, closesAt: null }, mode: "classroom" as const, timeZone: "Asia/Dubai",
});
const text = () => JSON.stringify(renderer.toJSON());
const content = (node: ReactTestInstance): string => node.children.map(child => typeof child === "string" ? child : content(child)).join("");
const button = (label: string) => renderer.root.findAllByType("button").find(node => content(node).includes(label));
const emit = (status: string, id = "class", updated_at = "2026-10-03T00:01:00Z") => {
  mocks.channels.flatMap(channel => channel.handlers).filter(handler => handler.table === "live_sessions")
    .forEach(handler => handler.callback({ new: { id, status, updated_at } }));
};
const mount = async (role: "student" | "teacher" = "student") => { await act(async () => { renderer = create(<NativeClassroom {...props(role)} />); }); };
const join = async () => { await act(async () => { await button("Join classroom")!.props.onClick(); }); };

beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); mocks.channels = []; FakePeer.all = [];
  mocks.row = { id: "class", status: "live", updated_at: "2026-10-03T00:00:00Z" };
  browser = new EventTarget(); documentEvents = new EventTarget();
  Object.assign(browser, { setTimeout, clearTimeout, setInterval, clearInterval });
  Object.assign(documentEvents, { visibilityState: "visible" });
  vi.stubGlobal("window", browser); vi.stubGlobal("document", documentEvents);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("RTCPeerConnection", FakePeer); vi.stubGlobal("MediaStream", FakeStream);
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.fetch.mockImplementation(async (url: string, options?: { body?: string }) => {
    const action = options?.body ? JSON.parse(options.body).action : "discovery";
    const value = action === "create" ? { connectionId: "connection", iceServers: [] }
      : action === "discovery" ? { tracks: [{ id: "mic", owner_id: "teacher", kind: "microphone" }] }
      : action === "subscribe" ? { tracks: [], sessionDescription: {} }
      : url.endsWith("/control") ? { status: action === "end" ? "completed" : "live" } : {};
    return { ok: true, status: 200, json: async () => value };
  });
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("authoritative classroom completion", () => {
  it("ends an already-joined Student, removes Live/Join and clears receivers without reload", async () => {
    await mount(); const retainedJoin = button("Join classroom")!.props.onClick;
    await join(); expect(FakePeer.all).toHaveLength(2);
    expect(text()).toContain("Live"); expect(text()).toContain("audio");
    await act(async () => { emit("completed"); });
    expect(text()).toContain("This class has ended."); expect(text()).not.toContain('"Live"');
    expect(button("Join classroom")).toBeUndefined(); expect(text()).not.toContain('"type":"audio"');
    expect(FakePeer.all.every(peer => peer.connectionState === "closed")).toBe(true); expect(mocks.stop).toHaveBeenCalled();
    const creations = () => mocks.fetch.mock.calls.filter(([, options]) => options?.body && JSON.parse(options.body).action === "create").length;
    expect(creations()).toBe(1);
    await act(async () => { await retainedJoin(); await vi.advanceTimersByTimeAsync(65_000); });
    expect(creations()).toBe(1); expect(text()).toContain("This class has ended.");
  });
  it("handles cancelled and ignores wrong-class, invalid and non-terminal updates", async () => {
    await mount(); await act(async () => { emit("completed", "other"); emit("unknown"); emit("live"); });
    expect(button("Join classroom")).toBeDefined();
    await act(async () => { emit("cancelled"); emit("live", "class", "2026-10-03T00:00:00Z"); });
    expect(text()).toContain("This class has ended."); expect(button("Join classroom")).toBeUndefined();
  });
  it.each(["focus", "online", "subscription"])("refetches a missed completion on %s", async boundary => {
    await mount(); await join(); mocks.row.status = "completed";
    await act(async () => {
      if (boundary === "subscription") mocks.channels.find(channel => channel.subscribed)?.subscribed?.("SUBSCRIBED");
      else browser.dispatchEvent(new Event(boundary));
    });
    expect(mocks.reads).toHaveBeenCalledTimes(1); expect(text()).toContain("This class has ended.");
    expect(FakePeer.all.every(peer => peer.connectionState === "closed")).toBe(true);
  });
  it("refetches an authoritative not-live heartbeat error without reviving reconnect state", async () => {
    await mount(); await join(); mocks.row.status = "completed";
    mocks.fetch.mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: "The class is not live" }) });
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(text()).toContain("This class has ended."); expect(button("Join classroom")).toBeUndefined();
  });
  it("preserves the normal Teacher End control request and local ended rendering", async () => {
    await mount("teacher"); await join();
    await act(async () => { await button("End class for everyone")!.props.onClick(); });
    expect(mocks.fetch.mock.calls.some(([url, options]) => url.endsWith("/control") && JSON.parse(options.body).action === "end")).toBe(true);
    expect(text()).toContain("This class has ended."); expect(FakePeer.all.every(peer => peer.connectionState === "closed")).toBe(true);
  });
  it("does not install a receiver when completion arrives during an in-flight join", async () => {
    await mount();
    let release!: (value: unknown) => void;
    const created = new Promise(resolve => { release = resolve; });
    const original = mocks.fetch.getMockImplementation()!;
    mocks.fetch.mockImplementation((url, options) => options?.body && JSON.parse(options.body).action === "create"
      ? created : original(url, options));
    await act(async () => { button("Join classroom")!.props.onClick(); });
    await act(async () => { emit("completed"); release({ ok: true, status: 200,
      json: async () => ({ connectionId: "late-connection", iceServers: [] }) }); });
    expect(FakePeer.all).toHaveLength(0); expect(text()).toContain("This class has ended.");
    expect(button("Join classroom")).toBeUndefined();
  });
  it("coalesces focus bursts and still catches completion inside the refetch cooldown", async () => {
    await mount(); await act(async () => { browser.dispatchEvent(new Event("focus")); });
    mocks.row.status = "completed";
    await act(async () => { browser.dispatchEvent(new Event("focus")); browser.dispatchEvent(new Event("online"));
      await vi.advanceTimersByTimeAsync(1_000); });
    expect(mocks.reads).toHaveBeenCalledTimes(2); expect(text()).toContain("This class has ended.");
  });
});
