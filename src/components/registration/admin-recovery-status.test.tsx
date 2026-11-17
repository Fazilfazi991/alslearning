import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
import { RegistrationDetail } from "./admin-detail";

vi.mock("next/link", () => ({ default: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a> }));
let renderer: ReactTestRenderer | undefined;
afterEach(async () => { if (renderer) await act(async () => renderer?.unmount()); renderer = undefined; vi.unstubAllGlobals(); });

it.each([
  { state: "unknown", blocked: true },
  { state: "claimed", blocked: true },
  { state: "provider_confirmed", blocked: false },
  { state: "future_state", blocked: true },
])("keeps resend gated for $state recovery operations", async ({ state, blocked }) => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith("/setup-recovery") ? { operations: [{ state }], student_active: true, independently_banned: false, student_role: "student" } : {
    application: { id: "test", full_name: "Synthetic Student", email: "student@example.test", phone: "123", qualification: "BSc", institution: "Test", program_id: "p", preferred_batch_id: null, notes: null, status: "approved", created_at: "2026-01-01T00:00:00Z", student_id: "student", invitation_status: "sent", programs: { name: "Program", status: "active" } },
    batches: [], programs: [], events: [], identity_conflict: false,
  } })));
  await act(async () => { renderer = create(<RegistrationDetail id="test" />); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  const resend = renderer!.root.findAllByType("button").find(item => item.children.includes("Send setup link"));
  expect(resend?.props.disabled).toBe(blocked);
  expect(renderer!.root.findAllByType("p").some(item => item.children.includes("Password update requires review"))).toBe(blocked && state !== "future_state");
});

it.each([{ student_active: false, independently_banned: false }, { student_active: true, independently_banned: true }])("keeps restricted accounts from requesting setup links", async account => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith("/setup-recovery") ? { operations: [], student_role: "student", ...account } : {
    application: { id: "test", full_name: "Synthetic Student", email: "student@example.test", phone: "123", qualification: "BSc", institution: "Test", program_id: "p", preferred_batch_id: null, notes: null, status: "approved", created_at: "2026-01-01T00:00:00Z", student_id: "student", invitation_status: "sent", programs: { name: "Program", status: "active" } }, batches: [], programs: [], events: [], identity_conflict: false,
  } })));
  await act(async () => { renderer = create(<RegistrationDetail id="test" />); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  expect(renderer!.root.findAllByType("button").find(item => item.children.includes("Send setup link"))?.props.disabled).toBe(true);
  expect(renderer!.root.findAllByType("p").some(item => item.children.includes("This account is not currently eligible for a setup link. Contact admissions support."))).toBe(true);
});

it("keeps resend disabled when the recovery status cannot be read", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/setup-recovery") ? { ok: false, json: async () => ({ error: "Unavailable" }) } : { ok: true, json: async () => ({
    application: { id: "test", full_name: "Synthetic Student", email: "student@example.test", phone: "123", qualification: "BSc", institution: "Test", program_id: "p", preferred_batch_id: null, notes: null, status: "approved", created_at: "2026-01-01T00:00:00Z", student_id: "student", invitation_status: "sent", programs: { name: "Program", status: "active" } }, batches: [], programs: [], events: [], identity_conflict: false,
  }) }));
  await act(async () => { renderer = create(<RegistrationDetail id="test" />); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  expect(renderer!.root.findAllByType("button").find(item => item.children.includes("Send setup link"))?.props.disabled).toBe(true);
  expect(renderer!.root.findAllByType("p").some(item => item.children.includes("Recovery status is unavailable. Contact admissions support before requesting another link."))).toBe(true);
});
