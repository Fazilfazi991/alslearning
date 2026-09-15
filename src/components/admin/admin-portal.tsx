"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminShell } from "./admin-shell";
import { AcademicWorkspaceManager } from "./academic-workspace";
import { CoreManager } from "./core-manager";
import { QuestionBank } from "./question-bank";
import { AdminBackendManager } from "./admin-backend-manager";
import { ConnectedDashboard } from "./connected-dashboard";
import { FacultyDirectoryManager } from "./faculty-directory";

export function AdminPortal() {
  const path = usePathname();
  let page: React.ReactNode = <ConnectedDashboard />;
  if (path === "/admin/students") page = <AdminBackendManager mode="enrollments" />;
  else if (path === "/admin/teachers") page = <FacultyDirectoryManager />;
  else if (path === "/admin/teacher-accounts") page = <AdminBackendManager mode="faculty" />;
  else if (path === "/admin/courses") page = <CoreManager mode="content" />;
  else if (path === "/admin/academic") page = <AcademicWorkspaceManager />;
  else if (path === "/admin/questions" || path === "/admin/question-bank") page = <QuestionBank />;
  else if (path === "/admin/tests") page = <CoreManager mode="tests" />;
  else if (path === "/admin/live-classes" || path.startsWith("/admin/live-classes/")) page = <UnavailableArea title="Live classes" />;
  else if (path === "/admin/live-learning") page = <UnavailableArea title="Live learning" />;
  else if (path === "/admin/activity" || path === "/admin/activity-log") page = <UnavailableArea title="Activity" />;
  else if (path.startsWith("/admin/students/")) page = <UnavailableArea title="Student details" />;
  else if (path.startsWith("/admin/teachers/")) page = <UnavailableArea title="Teacher details" />;
  else if (path.startsWith("/admin/courses/")) page = <UnavailableArea title="Course details" />;
  else if (path !== "/admin") page = <UnavailableArea title="Administration" />;
  return <AdminShell>{page}</AdminShell>;
}

function UnavailableArea({ title }: { title: string }) {
  return <div className="card mx-auto max-w-xl p-8"><h1 className="text-2xl font-bold">{title} unavailable</h1><p className="mt-3 text-sm text-muted">This area has not been configured for ALS administration.</p><Link href="/admin" className="mt-5 inline-flex min-h-11 items-center rounded border px-4 text-sm font-bold">Back to dashboard</Link></div>;
}
