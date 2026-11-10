import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PublicRegistration } from "./public-registration";

const program = { id: "b3548351-7268-4d05-87f8-f5804d333b5d", name: "Laboratory science", description: null };
let renderer: ReactTestRenderer;
const input = (name: string) => renderer.root.findAllByType("input").find(node => node.props.id === `registration-${name}`)!;
const text = (node: ReactTestInstance): string => node.children.map(child => typeof child === "string" ? child : text(child)).join("");
const button = (label: string) => renderer.root.findAllByType("button").find(node => text(node).includes(label))!;
const submit = () => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} });
const fill = async (name: string, value: string) => { await act(async () => input(name).props.onChange({ target: { value } })); };
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("window", { requestAnimationFrame: (callback: () => void) => callback() }); });
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); vi.unstubAllGlobals(); });
it("validates each step and retains answers and the preselected program when navigating", async () => {
  await act(async () => { renderer = create(<PublicRegistration programs={[program]} initialProgram={program.id} unavailable={false} />, { createNodeMock: () => ({ focus: vi.fn() }) }); });
  await act(async () => { await submit(); }); expect(text(renderer.root)).toContain("Enter your full name");
  await fill("fullName", "Test Student"); await fill("email", "student@example.test"); await fill("phone", "+919876543210");
  await act(async () => { await submit(); }); await fill("qualification", "BSc MLT"); await fill("institution", "Test College");
  await act(async () => { await submit(); }); expect(renderer.root.findByType("select").props.value).toBe(program.id);
  await act(async () => button("Back").props.onClick()); expect(input("qualification").props.value).toBe("BSc MLT");
  await act(async () => { await submit(); }); await act(async () => { await submit(); }); expect(text(renderer.root)).toContain("Laboratory science");
  await act(async () => { await submit(); }); expect(text(renderer.root)).toContain("Please consent");
});
