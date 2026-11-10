import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EnquiryForm } from "./enquiry-form";

const program = { id: "b3548351-7268-4d05-87f8-f5804d333b5d", name: "Example program" };
let renderer: ReactTestRenderer;
const input = (id: string) => renderer.root.findAllByType("input").find(node => node.props.id === id)!;
const text = (node: ReactTestInstance): string => node.children.map(child => typeof child === "string" ? child : text(child)).join("");
const button = (label: string) => renderer.root.findAllByType("button").find(node => text(node).includes(label))!;
const submit = () => renderer.root.findByType("form").props.onSubmit({ preventDefault: () => {}, currentTarget: {} });

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("document", { getElementById: () => ({ focus: vi.fn() }) });
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => { callback(); return 1; });
  vi.stubGlobal("FormData", class { get() { return ""; } });
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); vi.unstubAllGlobals(); });

it("preserves answers and a preselected program while navigating and skipping goals", async () => {
  await act(async () => { renderer = create(<EnquiryForm programs={[program]} initialProgram={program.id} />, { createNodeMock: () => ({ focus: vi.fn() }) }); });
  await act(async () => { input("enquiry-name").props.onChange({ target: { value: "Test Student" } }); });
  await act(async () => { await submit(); });
  expect(renderer.root.findAllByType("input").find(node => node.props.name === "programId")!.props.checked).toBe(true);
  await act(async () => { button("Back").props.onClick(); });
  expect(input("enquiry-name").props.value).toBe("Test Student");
  await act(async () => { await submit(); });
  await act(async () => { await submit(); });
  expect(button("Skip for now")).toBeDefined();
  await act(async () => { await submit(); });
  expect(input("enquiry-phone")).toBeDefined();
});

it("blocks duplicate in-flight submissions and retains the retry key after a failure", async () => {
  let finish!: (value: unknown) => void;
  const first = new Promise(resolve => { finish = resolve; });
  const fetchMock = vi.fn().mockReturnValueOnce(first).mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });
  vi.stubGlobal("fetch", fetchMock);
  await act(async () => { renderer = create(<EnquiryForm programs={[program]} initialProgram={program.id} />, { createNodeMock: () => ({ focus: vi.fn() }) }); });
  await act(async () => { input("enquiry-name").props.onChange({ target: { value: "Test Student" } }); });
  await act(async () => { await submit(); });
  await act(async () => { await submit(); });
  await act(async () => { await submit(); });
  await act(async () => { input("enquiry-phone").props.onChange({ target: { value: "+12025550199" } }); });
  const consent = renderer.root.findAllByType("input").find(node => node.props.name === "consent")!;
  await act(async () => { consent.props.onChange({ target: { checked: true } }); });
  let pending!: Promise<void>;
  await act(async () => { pending = submit(); });
  await act(async () => { await submit(); });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await act(async () => { finish({ ok: false, json: async () => ({ error: "Please try again." }) }); await pending; });
  expect(text(renderer.root)).toContain("Please try again.");
  expect(input("enquiry-phone").props.value).toBe("+12025550199");
  await act(async () => { await submit(); });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body);
  const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
  expect(secondBody.idempotencyKey).toBe(firstBody.idempotencyKey);
  expect(secondBody.programId).toBe(program.id);
  expect(text(renderer.root)).toContain("Thank you for your interest.");
});

it("requires a program before advancing", async () => {
  await act(async () => { renderer = create(<EnquiryForm programs={[program]} />, { createNodeMock: () => ({ focus: vi.fn() }) }); });
  await act(async () => { input("enquiry-name").props.onChange({ target: { value: "Test Student" } }); });
  await act(async () => { await submit(); });
  await act(async () => { await submit(); });
  expect(text(renderer.root)).toContain("Choose an available program to continue.");
  expect(renderer.root.findByType("fieldset").props.id).toBe("program-options");
});
