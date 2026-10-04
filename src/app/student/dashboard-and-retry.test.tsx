import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Children, isValidElement } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

const mock = vi.hoisted(() => ({ studentData: vi.fn() }));
vi.mock("@/lib/student-data", () => ({ getStudentPortalData: mock.studentData }));

import Dashboard from "./page";
import ExamsError from "./exams/error";
import ProgressError from "./progress/error";
import NotificationsError from "./notifications/error";
import CertificatesError from "./certificates/error";
import HelpError from "./help/error";
import CoursesError from "./courses/error";
import LiveClassesError from "./live-classes/error";

describe("student dashboard truth", () => {
  it("uses distinct programs, future classes, eligible test states, and persisted watch intervals", async () => {
    const now = Date.now();
    mock.studentData.mockResolvedValue({
      user: { full_name: "Student Example" }, fetchedAt: now,
      enrollments: [
        { programs: { id: "program-1", name: "Science", slug: "science" } },
        { programs: { id: "program-1", name: "Science", slug: "science" } },
      ],
      content: [], progress: [], subjectMappings: [],
      sessions: [
        { id: "future", title: "Future class", status: "scheduled", starts_at: new Date(now + 60_000).toISOString() },
        { id: "past", title: "Past class", status: "scheduled", starts_at: new Date(now - 60_000).toISOString() },
        { id: "live", title: "Live class", status: "live", starts_at: new Date(now - 60_000).toISOString() },
        { id: "complete", title: "Completed class", status: "completed", starts_at: new Date(now - 120_000).toISOString() },
      ],
      tests: ["available", "in_progress", "upcoming", "completed", "closed"].map((state, index) => ({ id: String(index), slug: `test-${index}`, title: `Test ${index}`, state })),
      attempts: [],
      watchEvents: [{ elapsed_seconds: 90, ended_at: new Date(now - 60_000).toISOString(), content_kind: "lesson" }],
    });
    const html = renderToStaticMarkup(await Dashboard());
    expect(html).toMatch(/<strong[^>]*>1<\/strong><p[^>]*>Active programs<\/p>/);
    expect(html).toMatch(/<strong[^>]*>1<\/strong><p[^>]*>Upcoming classes<\/p>/);
    expect(html).toMatch(/<strong[^>]*>1 min<\/strong><p[^>]*>Time watched<\/p>/);
    expect(html).toMatch(/<strong[^>]*>1<\/strong><p[^>]*>Tests to take<\/p>/);
    expect(html).toContain("1 to resume");
    expect(html).not.toContain("Past class");
    expect(html).not.toContain("Completed class");
  });
});

describe("student error recovery", () => {
  it("invokes the retry callback from the shared error card", () => {
    const retry = vi.fn();
    const card = ErrorState({ title: "Load failed", onRetry: retry });
    const content = card.props.children;
    const button = Children.toArray(content.props.children).find(child => isValidElement(child) && child.type === Button);
    expect(button).toBeDefined();
    if (!isValidElement(button)) throw new Error("Retry button missing");
    (button.props as { onClick?: () => void }).onClick?.();
    expect(retry).toHaveBeenCalledOnce();
  });

  it.each([
    ["exams", ExamsError], ["progress", ProgressError],
    ["notifications", NotificationsError], ["certificates", CertificatesError], ["help", HelpError],
    ["live classes", LiveClassesError],
  ])("passes Next retry into the %s error page", (_, ErrorPage) => {
    const retry = vi.fn();
    const view = ErrorPage({ retry });
    expect(view.type).toBe(ErrorState);
    expect(view.props.onRetry).toBe(retry);
  });

  it("refetches Courses data through Next retry", () => {
    const retry = vi.fn();
    const view = CoursesError({ retry });
    const button = Children.toArray(view.props.children).find(child => isValidElement(child) && child.type === "button");
    expect(button).toBeDefined();
    if (!isValidElement(button)) throw new Error("Courses retry button missing");
    (button.props as { onClick?: () => void }).onClick?.();
    expect(retry).toHaveBeenCalledOnce();
  });
});
