import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ rpc: vi.fn(), getUserById: vi.fn(), inviteUserByEmail: vi.fn(), resetPasswordForEmail: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAuthAdminClient: () => ({ rpc: mock.rpc, auth: { admin: { getUserById: mock.getUserById, inviteUserByEmail: mock.inviteUserByEmail }, resetPasswordForEmail: mock.resetPasswordForEmail } }) }));
import { sendRegistrationInvitation } from "./registration-invitation";

beforeEach(() => {
  vi.stubEnv("REGISTRATION_INVITATION_ENABLED", "true");
  vi.stubEnv("REGISTRATION_SETUP_SECRET", "a-secret-long-enough-for-test-only-0001");
  vi.stubEnv("REGISTRATION_SITE_URL", "https://als.example");
  mock.rpc.mockResolvedValue({ data: true, error: null });
  mock.resetPasswordForEmail.mockResolvedValue({ error: null });
  mock.inviteUserByEmail.mockResolvedValue({ data: { user: { id: "student" } }, error: null });
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("registration invitation recovery", () => {
  it("defers delivery without attempting an invitation when email is disabled", async () => {
    vi.stubEnv("REGISTRATION_INVITATION_ENABLED", "false");
    expect(await sendRegistrationInvitation("registration", "student", "student@example.test")).toBe("deferred");
    expect(mock.rpc).not.toHaveBeenCalled();
    expect(mock.inviteUserByEmail).not.toHaveBeenCalled();
  });
  it("invites an unconfirmed approved identity", async () => {
    mock.getUserById.mockResolvedValue({ data: { user: { id: "student", email: "student@example.test", email_confirmed_at: null } }, error: null });
    expect(await sendRegistrationInvitation("registration", "student", "student@example.test")).toBe("sent");
    expect(mock.inviteUserByEmail).toHaveBeenCalledOnce();
    expect(mock.resetPasswordForEmail).not.toHaveBeenCalled();
  });
  it("does not send recovery unless separately enabled", async () => {
    mock.getUserById.mockResolvedValue({ data: { user: { id: "student", email: "student@example.test", email_confirmed_at: "2026-01-01" } }, error: null });
    expect(await sendRegistrationInvitation("registration", "student", "student@example.test")).toBe("failed");
    expect(mock.resetPasswordForEmail).not.toHaveBeenCalled();
  });
  it("sends a signed, identity-bound recovery redirect for an approved confirmed account", async () => {
    vi.stubEnv("REGISTRATION_RECOVERY_ENABLED", "true");
    mock.getUserById.mockResolvedValue({ data: { user: { id: "student", email: "student@example.test", email_confirmed_at: "2026-01-01" } }, error: null });
    expect(await sendRegistrationInvitation("registration", "student", "student@example.test")).toBe("sent");
    const redirect = new URL(mock.resetPasswordForEmail.mock.calls[0][1].redirectTo);
    expect(redirect.origin).toBe("https://als.example");
    expect(redirect.pathname).toBe("/auth/callback");
    expect(redirect.searchParams.get("registration_recovery")).toBeTruthy();
    expect(mock.inviteUserByEmail).not.toHaveBeenCalled();
  });
  it("does not send if the fetched identity does not match", async () => {
    vi.stubEnv("REGISTRATION_RECOVERY_ENABLED", "true");
    mock.getUserById.mockResolvedValue({ data: { user: { id: "other", email: "student@example.test", email_confirmed_at: "2026-01-01" } }, error: null });
    expect(await sendRegistrationInvitation("registration", "student", "student@example.test")).toBe("failed");
    expect(mock.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});
