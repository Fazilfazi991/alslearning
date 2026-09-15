import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LoginForm } from "./login-form";

describe("login before hydration", () => {
  it("never falls back to a GET that exposes credentials in the URL", () => {
    const html=renderToStaticMarkup(<LoginForm/>);
    expect(html).toContain('method="post"');
    expect(html).toContain('action="/api/auth/password"');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*type="submit"/);
    expect(html).not.toContain("magic link");
  });
});
