import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
import { SetupForm } from "./setup-form";
import { randomBytes } from "node:crypto";

let renderer: ReactTestRenderer | undefined;
afterEach(async () => { if (renderer) await act(async () => renderer?.unmount()); renderer = undefined; vi.unstubAllGlobals(); });

it("stops same-link retries and warns of uncertainty when the response is lost", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const send = vi.fn().mockRejectedValue(new Error("synthetic disconnect"));
  vi.stubGlobal("fetch", send);
  await act(async () => { renderer = create(<SetupForm />); });
  const testPassword = `Aa1!${randomBytes(24).toString("hex")}`;
  await act(async () => {
    for (const input of renderer!.root.findAllByType("input")) input.props.onChange({ target: { value: testPassword } });
  });
  await act(async () => { await renderer!.root.findByType("form").props.onSubmit({ preventDefault() {} }); });
  expect(send).toHaveBeenCalledOnce();
  expect(renderer!.root.findByProps({ role: "alert" }).children.join(" ")).toContain("password may have changed");
  expect(renderer!.root.findAllByType("form")).toHaveLength(0);
  expect(renderer!.root.findAllByType("input")).toHaveLength(0);
});
