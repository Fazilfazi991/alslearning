import { describe, expect, it, vi } from "vitest";
const exchange = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createClient: exchange }));
import { GET } from "./route";

describe("retired email callback", () => {
  it.each(["?code=old", "?token_hash=old&type=magiclink", "?token_hash=old&type=email", "?next=https://evil.example", ""])("routes old links to password login without establishing a session: %s", async query => {
    const response = await GET(new Request(`https://alslearning.vercel.app/auth/callback${query}`));
    expect(response.headers.get("location")).toBe("https://alslearning.vercel.app/login");
    expect(exchange).not.toHaveBeenCalled();
  });
});
