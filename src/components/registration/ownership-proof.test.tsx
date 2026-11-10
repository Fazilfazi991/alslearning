import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
import { OwnershipProof, ownershipProofStorageKey } from "./ownership-proof";
vi.mock("next/link", () => ({ default: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a> }));

let renderer: ReactTestRenderer | undefined;
afterEach(async () => { if (renderer) await act(async () => renderer?.unmount()); renderer = undefined; vi.unstubAllGlobals(); });

it("restores the opaque request in the original tab and retains it for re-verification", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const store = { getItem: vi.fn().mockReturnValue("request-id"), removeItem: vi.fn() };
  vi.stubGlobal("window", { sessionStorage: store });
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
  vi.stubGlobal("fetch", fetchMock);
  await act(async () => { renderer = create(<OwnershipProof />); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
  expect(store.getItem).toHaveBeenCalledWith(ownershipProofStorageKey);
  const login = renderer!.root.findByType("a");
  expect(login.props.href).toBe("/login");
  expect(login.props.target).toBe("_blank");
  await act(async () => { await renderer!.root.findByType("button").props.onClick(); });
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ requestId: "request-id" });
  expect(store.removeItem).not.toHaveBeenCalled();
  expect(renderer!.root.findAllByType("button")).toHaveLength(0);
});

it("keeps the request when a student needs to sign in", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const store = { removeItem: vi.fn() };
  vi.stubGlobal("window", { sessionStorage: store });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Sign in first." }) }));
  await act(async () => { renderer = create(<OwnershipProof requestId="request-id" />); });
  await act(async () => { await renderer!.root.findByType("button").props.onClick(); });
  expect(store.removeItem).not.toHaveBeenCalled();
  expect(renderer!.root.findByProps({ role: "status" }).children).toContain("Sign in first.");
});
