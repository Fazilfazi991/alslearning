import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Children, isValidElement } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

const mock = vi.hoisted(() => ({ studentData: vi.fn(), recordingCount: vi.fn() }));
vi.mock("@/lib/student-data", () => ({ getStudentPortalData: mock.studentData }));
vi.mock("@/lib/student-courses-server", () => ({ studentRecordingCount: mock.recordingCount }));

import Dashboard from "./page";
import ExamsError from "./exams/error";
import ProgressError from "./progress/error";
import NotificationsError from "./notifications/error";
import CertificatesError from "./certificates/error";
import HelpError from "./help/error";

describe("student dashboard truth", () => {
  it("counts only future scheduled classes and available tests", async () => {
    const now = Date.now();
    mock.recordingCount.mockResolvedValue(4);
    mock.studentData.mockResolvedValue({
      user: { full_name: "Student" }, enrollments: [{}], content: [], progress: [],
      sessions: [
        { status: "scheduled", starts_at: new Date(now + 60_000).toISOString() },
        { status: "scheduled", starts_at: new Date(now - 60_000).toISOString() },
        { status: "live", starts_at: new Date(now - 60_000).toISOString() },
        { status: "completed", starts_at: new Date(now - 120_000).toISOString() },
      ],
      tests: ["available", "in_progress", "upcoming", "completed", "closed"].map(state => ({ state })),
    });
    const html = renderToStaticMarkup(await Dashboard());
    expect(html).toMatch(/<strong[^>]*>1<\/strong><p[^>]*>Upcoming classes<\/p>/);
    expect(html).toMatch(/<strong[^>]*>1<\/strong><p[^>]*>Available tests<\/p>/);
    expect(html).toMatch(/<strong[^>]*>4<\/strong><p[^>]*>Recorded classes<\/p>/);
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
  ])("passes Next retry into the %s error page", (_, ErrorPage) => {
    const retry = vi.fn();
    const view = ErrorPage({ retry });
    expect(view.type).toBe(ErrorState);
    expect(view.props.onRetry).toBe(retry);
  });
});
