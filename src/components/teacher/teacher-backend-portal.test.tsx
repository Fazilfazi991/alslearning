import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({ getTeacherData: vi.fn() }));
vi.mock("@/lib/teacher-data", () => ({ getTeacherData: mocks.getTeacherData }));
vi.mock("./teacher-shell", () => ({ TeacherShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/lib/live-class/config", () => ({ liveClassConfiguration: () => ({ classroomEnabled: true, realtimeConfigured: true }) }));
vi.mock("@/lib/live-class/staging-window", () => ({ stagingTestWindowOpen: () => false }));

import { TeacherBackendPortal } from "./teacher-backend-portal";

const base = {
  user: { id: "teacher", role: "teacher", full_name: "Demo Teacher", email: "teacher@example.invalid" },
  assignments: [
    { id: "assignment", program_id: "program", subject_id: "subject", programs: { id: "program", name: "Demo Diagnostics" }, subjects: { id: "subject", name: "Clinical Chemistry" } },
  ],
  batches: [{ id: "batch", name: "October cohort", program_id: "program", status: "active", access_expires_at: null }],
  studentCount: 1,
  students: [{ id: "enrollment", student_id: "student", name: "Demo Student", email: "student@example.invalid", program: "Demo Diagnostics", batch: "October cohort", status: "active", expires_at: "2026-10-08T12:00:00Z" }],
  questionCount: 3,
  testCount: 2,
  contentCount: 6,
  sessions: [{ id: "class", title: "Review class", status: "scheduled", provider: "cloudflare", starts_at: "2026-10-03T10:00:00Z", recording_enabled: true, subjects: { name: "Clinical Chemistry" }, batches: { name: "October cohort" }, class_recordings: [] }],
};

describe("scoped Teacher workspaces", () => {
  beforeEach(() => mocks.getTeacherData.mockResolvedValue(base));

  it("shows assignment scoped dashboard totals and working quick-action routes", async () => {
    const html = renderToStaticMarkup(await TeacherBackendPortal({ section: "dashboard" }));
    expect(html).toContain("Scoped enrollments");
    expect(html).toContain("Visible questions");
    expect(html).toContain("Demo Diagnostics");
    expect(html).toContain("1 assigned subjects · 1 assigned batches");
    for (const route of ["/teacher/courses", "/teacher/students", "/teacher/question-bank", "/teacher/content", "/teacher/live-classes"])
      expect(html).toContain(`href="${route}"`);
  });

  it("connects each assigned course to its Subject, batch and workspaces", async () => {
    const html = renderToStaticMarkup(await TeacherBackendPortal({ section: "courses" }));
    expect(html).toContain("Clinical Chemistry");
    expect(html).toContain("October cohort");
    expect(html).toContain("Question bank");
    expect(html).toContain("Assessments");
    expect(html).toContain("Study materials");
  });

  it("shows per-Program roster access and future expiry without calling enrollment rows distinct students", async () => {
    const html = renderToStaticMarkup(await TeacherBackendPortal({ section: "students", search: "Demo", page: 0 }));
    expect(html).toContain("1 matching enrollment");
    expect(html).toContain("Demo Student");
    expect(html).toContain("Access expires:");
    expect(html).toContain("Clear search");
    expect(html).not.toContain("assigned students</span>");
  });

  it("keeps classroom entry unavailable when the staging window is closed even if feature flags are enabled", async () => {
    const html = renderToStaticMarkup(await TeacherBackendPortal({ section: "live-classes" }));
    expect(html).toContain("Live media is currently unavailable");
    expect(html).toContain("Live entry currently unavailable");
    expect(html).not.toContain("Start or join class");
    expect(html).not.toContain("CF_REALTIME_APP_ID");
  });
});
