import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EnquiryDetail } from "./enquiries-detail";

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
const studentId = "verified-student";
vi.mock("next/link", () => ({ default: (props: Record<string, unknown>) => <a {...props} /> }));
vi.mock("./enquiries-shared", async importOriginal => ({ ...await importOriginal<typeof import("./enquiries-shared")>(), enquiryRequest: mocks.request }));
vi.mock("./student-manager", () => ({ StudentAdmissionForm: ({ onCreated }: { onCreated: (id: string) => void }) => <button onClick={() => onCreated(studentId)}>Complete verified admission</button> }));

const detail = {
  enquiry: { id: "enquiry", full_name: "Synthetic applicant", phone: "+919876543210", email: null, program_id: "program", message: null, status: "interested", assigned_to: null, student_id: null, created_at: "2026-11-06T00:00:00Z", updated_at: "2026-11-06T00:00:00Z", programs: { id: "program", name: "Program" } },
  activities: [], follow_ups: [], staff: [],
};
let renderer: ReactTestRenderer;
const text = (node: ReactTestInstance): string => node.children.map(child => typeof child === "string" ? child : text(child)).join("");
const button = (label: string) => renderer.root.findAllByType("button").find(node => text(node) === label)!;
const studentLinks = () => renderer.root.findAllByType("a").filter(node => text(node) === "Open student profile");

beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); });
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); vi.unstubAllGlobals(); });

it("keeps the verified student link and converted state when history refresh fails, with a working retry", async () => {
  mocks.request.mockResolvedValueOnce(structuredClone(detail))
    .mockResolvedValueOnce({ programs: [{ id: "program", name: "Program" }], batches: [] })
    .mockRejectedValueOnce(Error("History temporarily unavailable"))
    .mockResolvedValueOnce({ ...structuredClone(detail), activities: [{ id: "note", kind: "note", note: "History refreshed", actor_id: null, created_at: "2026-11-06T00:00:00Z" }] });
  await act(async () => { renderer = create(<EnquiryDetail id="enquiry" />, { createNodeMock: element => element.type === "dialog" ? { showModal: vi.fn(), close: vi.fn() } : null }); });
  expect(studentLinks()).toHaveLength(0);
  await act(async () => { button("Convert to student").props.onClick(); });
  await act(async () => { button("Complete verified admission").props.onClick(); });

  expect(studentLinks()).toHaveLength(1);
  expect(studentLinks()[0].props.href).toBe(`/admin/students/${studentId}`);
  expect(button("Convert to student")).toBeUndefined();
  expect(renderer.root.findAllByType("select").find(node => node.props.value === "converted")?.props.disabled).toBe(true);
  expect(text(renderer.root)).toContain("Student admission is complete, but the latest enquiry history could not be refreshed");
  expect(button("Retry")).toBeDefined();

  await act(async () => { button("Retry").props.onClick(); });
  expect(text(renderer.root)).toContain("History refreshed");
  expect(studentLinks()[0].props.href).toBe(`/admin/students/${studentId}`);
  expect(renderer.root.findAllByType("select").find(node => node.props.value === "converted")?.props.disabled).toBe(true);
});
