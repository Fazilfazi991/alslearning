import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
import { LoginForm } from "./login-form";

describe("login-only password form", () => {
  it("provides accessible password-manager fields and mobile-sized inputs without signup or email-link controls", () => {
    const html = renderToStaticMarkup(<LoginForm/>);
    expect(html).toContain('type="email"');
    expect(html).toContain('type="password"');
    expect(html).toContain('autoComplete="username"');
    expect(html).toContain('autoComplete="current-password"');
    expect(html).toContain('aria-label="Show password"');
    expect(html.match(/text-base/g)).toHaveLength(2);
    expect(html).toContain("Sign in");
    expect(html).not.toMatch(/sign.up|magic.link|one.time|sign-in link|QA password/i);
  });
  it("announces sign-in errors", () => {
    const html = renderToStaticMarkup(<LoginForm initialError="Incorrect email or password."/>);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Incorrect email or password.");
  });
});
