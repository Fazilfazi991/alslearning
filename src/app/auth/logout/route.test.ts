import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ signOut: vi.fn(), getAll: vi.fn(), set: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { signOut: mock.signOut } }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: mock.getAll, set: mock.set }) }));
import { POST } from "./route";

const request = (origin="https://alslearning.vercel.app") => new Request("https://alslearning.vercel.app/auth/logout",{method:"POST",headers:{origin}});

describe("account switching sign-out", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mock.signOut.mockResolvedValue({error:null});
    mock.getAll.mockReturnValue([
      {name:"sb-dvmahmkapgtjfqmoottt-auth-token.0",value:"old"},
      {name:"sb-dvmahmkapgtjfqmoottt-auth-token.1",value:"old"},
      {name:"preferred-theme",value:"light"},
    ]);
  });
  it("revokes only the current Supabase session and expires all its SSR cookie chunks",async()=>{
    const response=await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({signedOut:true});
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mock.signOut).toHaveBeenCalledWith({scope:"local"});
    expect(mock.set).toHaveBeenCalledTimes(2);
    expect(mock.set).toHaveBeenCalledWith("sb-dvmahmkapgtjfqmoottt-auth-token.0","",{path:"/",maxAge:0});
    expect(mock.set).not.toHaveBeenCalledWith("preferred-theme",expect.anything(),expect.anything());
  });
  it("rejects a cross-origin logout without touching the authenticated session",async()=>{
    expect((await POST(request("https://unrelated.example"))).status).toBe(403);
    expect(mock.signOut).not.toHaveBeenCalled();
  });
});
