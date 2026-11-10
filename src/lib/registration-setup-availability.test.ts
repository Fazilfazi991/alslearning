import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { GET, POST as callbackPost } from "@/app/auth/callback/route";
import { POST as setupPost } from "@/app/api/auth/setup/route";
import { sendRegistrationInvitation } from "@/lib/registration-invitation";

it("keeps invitation and password setup unavailable with the real release guard", async () => {
  vi.stubEnv("REGISTRATION_INVITATION_ENABLED", "true");
  try {
    expect(await sendRegistrationInvitation("registration", "student", "student@example.test")).toBe("deferred");
    expect((await GET(new Request("https://als.example/auth/callback?token_hash=synthetic&type=invite"))).status).toBe(503);
    expect((await callbackPost(new Request("https://als.example/auth/callback", { method: "POST" }))).status).toBe(503);
    expect((await setupPost(new Request("https://als.example/api/auth/setup", { method: "POST" }))).status).toBe(503);
  } finally { vi.unstubAllEnvs(); }
});
