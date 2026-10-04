import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mock = vi.hoisted(() => ({ notFound: vi.fn(), studentData: vi.fn(), classroomData: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: mock.notFound, usePathname: () => "/student" }));
vi.mock("@/lib/student-data", () => ({ getStudentPortalData: mock.studentData }));
vi.mock("@/lib/live-class/classroom-data", () => ({ getClassroomData: mock.classroomData }));
vi.mock("@/components/live/classroom-screen", () => ({ ClassroomScreen: ({ data }: { data: { session: { title: string } } }) => <h1>{data.session.title}</h1> }));
import LiveDetail from "./live-classes/[classId]/page";
import CertificateDetail from "./certificates/[certificateId]/page";
import { StudentShell } from "@/components/student/student-shell";
import { HelpCenter } from "@/components/student/help-center";

describe("Student pages never invent client records", () => {
  it("rejects an unknown live session instead of entering a fabricated room", async () => {
    mock.classroomData.mockResolvedValue(null);
    mock.notFound.mockImplementation(() => { throw new Error("404"); });
    await expect(LiveDetail({params:Promise.resolve({classId:"arbitrary"})})).rejects.toThrow("404");
  });
  it("renders only a real, RLS-visible class title without invented chat or attendance", async () => {
    mock.classroomData.mockResolvedValue({session:{id:"real",title:"Assigned review"},recordings:[]});
    const html=renderToStaticMarkup(await LiveDetail({params:Promise.resolve({classId:"real"})}));
    expect(html).toContain("Assigned review");
    expect(html).not.toContain("Clinical Enzyme Interpretation");
    expect(html).not.toContain("38 learners");
  });
  it("never presents an arbitrary certificate as verified", () => {
    expect(() => CertificateDetail()).toThrow("404");
  });
  it("does not claim a support request was delivered", () => {
    const html=renderToStaticMarkup(<HelpCenter/>);
    expect(html).toContain("No request is sent from this page");
    expect(html).not.toContain("ALS-SUP-1284");
    expect(html).not.toContain("Submit Request");
  });
  it("shows an unread badge only for actual unread notifications and links to a real Profile", () => {
    const user={name:"ALS Student",email:"student@als.com"};
    const empty=renderToStaticMarkup(<StudentShell user={user} unreadCount={0}><p>Learning</p></StudentShell>);
    expect(empty).toContain('aria-label="Notifications"');
    expect(empty).toContain('href="/student/profile"');
    expect(empty).not.toContain("0 unread notifications");
    const unread=renderToStaticMarkup(<StudentShell user={user} unreadCount={3}><p>Learning</p></StudentShell>);
    expect(unread).toContain('aria-label="3 unread notifications"');
  });
});
