import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
import { ExistingStudentApproval } from "./existing-student-approval";
let renderer: ReactTestRenderer;
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); vi.unstubAllGlobals(); });
it("offers linking only after a verified proof and submits the selected batch", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ ready: true }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, linked_existing: true }) });
  vi.stubGlobal("fetch", fetchMock);
  const onApproved = vi.fn().mockResolvedValue(undefined);
  await act(async () => { renderer = create(<ExistingStudentApproval id="application" batchId="batch" eligible disabled={false} onApproved={onApproved} />); });
  const button = renderer.root.findByType("button");
  expect(button.props.disabled).toBe(false);
  await act(async () => { button.props.onClick(); });
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ batch_id: "batch" });
  expect(onApproved).toHaveBeenCalledOnce();
});
it("does not offer approval when no valid proof exists", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ready: false }) }));
  await act(async () => { renderer = create(<ExistingStudentApproval id="application" batchId="batch" eligible disabled={false} onApproved={vi.fn()} />); });
  expect(renderer.root.findAllByType("button")).toHaveLength(0);
});
