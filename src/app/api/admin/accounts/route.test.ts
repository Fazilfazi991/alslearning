import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ getUser: vi.fn(), single: vi.fn(), select: vi.fn(), eq: vi.fn(), order: vi.fn(), update: vi.fn(), createUser: vi.fn(), deleteUser: vi.fn(), updateUserById: vi.fn(), adminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mock.getUser }, from: () => ({ select: mock.select, update: mock.update }) }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAuthAdminClient: mock.adminClient }));
import { GET, POST, PATCH } from "./route";
const targetId = "e9e32ed8-f751-4a5c-86c6-cc3dc5f61f74";
const payload = { role: "teacher", email: "teacher@example.test", full_name: "Test Teacher", password: "Test-Only#42" };
const request = (method: string, body?: unknown, origin = "https://alslearning.vercel.app") => new Request("https://alslearning.vercel.app/api/admin/accounts?role=teacher", { method, headers: { origin, host: "alslearning.vercel.app", "content-type": "application/json" }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });

describe("Admin account administration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    const chain = { select: mock.select, eq: mock.eq, single: mock.single, order: mock.order };
    mock.select.mockReturnValue(chain); mock.eq.mockReturnValue(chain); mock.update.mockReturnValue(chain);
    mock.getUser.mockResolvedValue({ data: { user: { id: "admin-id" } }, error: null });
    mock.single.mockResolvedValueOnce({ data: { role: "admin", is_active: true }, error: null });
    mock.adminClient.mockReturnValue({ auth: { admin: { createUser: mock.createUser, deleteUser: mock.deleteUser, updateUserById: mock.updateUserById } } });
    mock.createUser.mockResolvedValue({ data: { user: { id: targetId } }, error: null });
    mock.updateUserById.mockResolvedValue({ data: { user: { id: targetId } }, error: null });
    mock.deleteUser.mockResolvedValue({ error: null });
  });
  it.each([GET, POST, PATCH])("requires a verified session before touching privileged Auth", async handler => {
    mock.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await handler(request(handler === GET ? "GET" : handler === POST ? "POST" : "PATCH", handler === GET ? undefined : payload))).status).toBe(401);
    expect(mock.adminClient).not.toHaveBeenCalled();
  });
  it.each(["student", "teacher", "admin-inactive"])("rejects %s before creating or resetting any account", async role => {
    mock.single.mockReset().mockResolvedValue({ data: { role: role === "admin-inactive" ? "admin" : role, is_active: role !== "admin-inactive" }, error: null });
    expect((await POST(request("POST", payload))).status).toBe(403);
    expect(mock.createUser).not.toHaveBeenCalled();
  });
  it.each(["admin", "superuser", null])("cannot provision the role %s", async role => {
    expect((await POST(request("POST", { ...payload, role }))).status).toBe(400);
    expect(mock.adminClient).not.toHaveBeenCalled();
  });
  it.each([{ email: "invalid" }, { full_name: " " }, { password: "short" }, { password: "nocapitalor-symbol123" }])("validates required input %j", async change => {
    expect((await POST(request("POST", { ...payload, ...change }))).status).toBe(400);
    expect(mock.createUser).not.toHaveBeenCalled();
  });
  it.each(["student", "teacher"])("creates one Auth-backed %s and verifies the canonical profile", async role => {
    mock.single.mockResolvedValueOnce({ data: { id: targetId, role, is_active: true, email: payload.email, full_name: payload.full_name }, error: null });
    const response = await POST(request("POST", { ...payload, email: " TEACHER@example.test ", role, app_metadata: { role: "admin" } }));
    expect(response.status).toBe(201);
    expect(mock.createUser).toHaveBeenCalledWith({ email: payload.email, password: payload.password, email_confirm: true, app_metadata: { role }, user_metadata: { full_name: payload.full_name } });
    expect(mock.deleteUser).not.toHaveBeenCalled();
  });
  it("reports duplicate email and never deletes an existing user", async () => {
    mock.createUser.mockResolvedValue({ data: { user: null }, error: { code: "email_exists", message: "private provider detail" } });
    expect((await POST(request("POST", payload))).status).toBe(409);
    expect(mock.deleteUser).not.toHaveBeenCalled();
  });
  it("rolls back only the Auth account just created when profile provisioning fails", async () => {
    mock.single.mockResolvedValueOnce({ data: null, error: { message: "trigger failed" } });
    expect((await POST(request("POST", payload))).status).toBe(503);
    expect(mock.deleteUser).toHaveBeenCalledWith(targetId);
  });
  it("hides server configuration failures", async () => {
    mock.adminClient.mockImplementation(() => { throw Error("secret credential"); });
    const response = await POST(request("POST", payload));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("secret credential");
  });
  it.each(["admin", "unsupported"])("cannot edit or reset an existing %s", async role => {
    mock.single.mockResolvedValueOnce({ data: { id: targetId, role, is_active: true }, error: null });
    expect((await PATCH(request("PATCH", { id: targetId, password: payload.password }))).status).toBe(403);
    expect(mock.updateUserById).not.toHaveBeenCalled();
  });
  it.each([{ role: "admin" }, { email: "other@example.test" }, { id: "invalid" }, { is_active: "false" }, { password: "bad" }])("rejects unsafe changes %j", async change => {
    mock.single.mockResolvedValueOnce({ data: { id: targetId, role: "student", is_active: true }, error: null });
    expect((await PATCH(request("PATCH", { id: targetId, ...change }))).status).toBe(400);
    expect(mock.updateUserById).not.toHaveBeenCalled();
  });
  it("reports missing records instead of false success", async () => {
    mock.single.mockResolvedValueOnce({ data: null, error: null });
    expect((await PATCH(request("PATCH", { id: targetId, is_active: false }))).status).toBe(404);
  });
  it("resets a password through Auth without changing the role or inserting a profile", async () => {
    mock.single.mockResolvedValueOnce({ data: { id: targetId, role: "teacher", is_active: true }, error: null });
    expect((await PATCH(request("PATCH", { id: targetId, password: payload.password }))).status).toBe(200);
    expect(mock.updateUserById).toHaveBeenCalledWith(targetId, { password: payload.password });
    expect(mock.update).not.toHaveBeenCalled();
  });
  it("checks the actual updated row when deactivating a profile", async () => {
    mock.single.mockResolvedValueOnce({ data: { id: targetId, role: "student", is_active: true }, error: null }).mockResolvedValueOnce({ data: null, error: null });
    expect((await PATCH(request("PATCH", { id: targetId, is_active: false }))).status).toBe(503);
  });
  it.each([POST, PATCH])("rejects cross-origin writes before authentication", async handler => {
    expect((await handler(request("POST", payload, "https://evil.example"))).status).toBe(403);
    expect(mock.getUser).not.toHaveBeenCalled();
  });
  it("lists only the requested managed role with no cache", async () => {
    mock.order.mockResolvedValue({ data: [{ id: targetId, role: "teacher" }], error: null });
    const response = await GET(request("GET"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mock.eq).toHaveBeenCalledWith("role", "teacher");
  });
});
