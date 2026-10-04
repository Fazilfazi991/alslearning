import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "./request-origin";

describe("request origin", () => {
  it("uses the public Host when the reverse proxy supplies an internal URL", () => {
    expect(isSameOriginRequest(new Request("https://localhost:3000/api", { headers: { host: "alslearning.vercel.app", origin: "https://alslearning.vercel.app" } }))).toBe(true);
  });
  it.each(["https://evil.example", "http://alslearning.vercel.app", "not-a-url"])("rejects %s", origin => {
    expect(isSameOriginRequest(new Request("https://localhost:3000/api", { headers: { host: "alslearning.vercel.app", origin } }))).toBe(false);
  });
  it("fails closed when an origin is supplied without a Host", () => {
    expect(isSameOriginRequest(new Request("https://alslearning.vercel.app/api", { headers: { origin: "https://alslearning.vercel.app" } }))).toBe(false);
  });
});
