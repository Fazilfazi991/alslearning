"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CircleUserRound,
  Download,
  Edit3,
  Eye,
  GripVertical,
  Headphones,
  BookOpenCheck,
  Plus,
  Search,
  UserRoundCheck,
  X,
} from "lucide-react";
import { AdminShell } from "./admin-shell";
import {
  adminStudents,
  adminTeachers,
  auditEvents,
  batches,
  certificates,
  cmsSections,
  payments,
  supportTickets,
} from "@/lib/mock-data/admin-portal";
import {
  assessments,
  questionBank,
  teacherClasses,
  teacherCourses,
} from "@/lib/mock-data/teacher-portal";
import { AcademicWorkspaceManager } from "./academic-workspace";
import { AdminBackendManager } from "./admin-backend-manager";
const panel = "rounded-lg border border-[#e6cbd5] bg-white";
const input =
  "min-h-11 w-full rounded border border-[#d8b8c4] bg-white px-3 text-sm";
const primary =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded bg-brand px-4 text-sm font-bold text-white hover:bg-brand-dark";
const secondary =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded border border-[#d8b8c4] bg-white px-4 text-sm font-bold text-deep-blue hover:border-brand";
function Head({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {description && (
          <p className="mt-2 text-sm text-muted">{description}</p>
        )}
      </div>
      {action}
    </header>
  );
}
function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="border-l-2 border-brand px-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
        {label}
      </p>
      <strong className="mt-1 block text-2xl">{value}</strong>
      {detail && <span className="text-xs text-muted">{detail}</span>}
    </div>
  );
}
function Status({ s }: { s: string }) {
  const c = [
    "Active",
    "Paid",
    "Published",
    "Issued",
    "Resolved",
    "Connected",
  ].includes(s)
    ? "bg-green-50 text-green-800"
    : ["Pending", "Draft", "Eligible", "Open", "Not Configured"].includes(s)
      ? "bg-amber-50 text-amber-800"
      : "bg-slate-100 text-slate-700";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${c}`}>
      {s}
    </span>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-bold uppercase tracking-wide text-muted">
      <span className="mb-2 block">{label}</span>
      {children}
    </label>
  );
}
function Toast({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div
      role="status"
      className="fixed bottom-22 right-4 z-60 flex items-center gap-3 rounded-lg bg-[#173f32] px-4 py-3 text-sm font-bold text-white shadow-xl lg:bottom-6"
    >
      <CheckCircle2 />
      {text}
      <button onClick={onClose}>
        <X size={16} />
      </button>
    </div>
  );
}
function Confirm({
  title,
  body,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-60 grid place-items-center bg-black/40 p-4">
      <section
        role="dialog"
        aria-modal="true"
        className={`${panel} max-w-md p-6`}
      >
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="mt-3 text-sm text-muted">{body}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button className={secondary} onClick={onCancel}>
            Cancel
          </button>
          <button
            className="min-h-10 rounded bg-red-700 px-4 text-sm font-bold text-white"
            onClick={onConfirm}
          >
            Confirm
          </button>
        </div>
      </section>
    </div>
  );
}
function Tabs({
  items,
  active,
  setActive,
}: {
  items: string[];
  active: string;
  setActive: (x: string) => void;
}) {
  return (
    <div
      className="mb-5 flex overflow-x-auto border-b border-[#e4c7d1]"
      role="tablist"
    >
      {items.map((x) => (
        <button
          key={x}
          role="tab"
          aria-selected={active === x}
          onClick={() => setActive(x)}
          className={`min-h-11 shrink-0 border-b-2 px-4 text-sm font-bold ${active === x ? "border-brand text-brand" : "border-transparent text-muted"}`}
        >
          {x}
        </button>
      ))}
    </div>
  );
}
function Dashboard() {
  return (
    <>
      <Head
        title="Good morning"
        description="Here’s what’s happening across ALS today."
      />
      <div className="grid gap-5 xl:grid-cols-[1.4fr_.6fr]">
        <div className="space-y-5">
          <section
            className={`${panel} grid grid-cols-2 gap-6 p-5 md:grid-cols-3`}
          >
            <Stat label="Total Students" value="1,284" />
            <Stat label="Active Students" value="1,036" />
            <Stat label="Teachers" value="18" />
            <Stat label="Active Courses" value="24" />
            <Stat label="Classes This Week" value="14" />
            <Stat label="Completion Rate" value="68%" />
          </section>
          <div className="grid gap-5 lg:grid-cols-2">
            <Attention />
            <Growth />
          </div>
          <CoursePerformance />
          <section className={`${panel} p-5`}>
            <div className="flex justify-between">
              <h2 className="text-lg font-bold">Recent Payments</h2>
              <Link
                href="/admin/payments"
                className="text-sm font-bold text-brand"
              >
                View all
              </Link>
            </div>
            {payments.slice(0, 2).map((p) => (
              <div
                key={p.id}
                className="mt-3 flex items-center justify-between border-t border-[#ead1da] pt-3 text-sm"
              >
                <div>
                  <b>{p.student}</b>
                  <p className="text-xs text-muted">{p.course}</p>
                </div>
                <div className="text-right">
                  <b>AED {p.amount}</b>
                  <p>
                    <Status s={p.status} />
                  </p>
                </div>
              </div>
            ))}
          </section>
        </div>
        <aside className="space-y-5">
          <section className={`${panel} p-5`}>
            <h2 className="text-lg font-bold">Today</h2>
            {[
              ["10:00 AM", "Hematology Revision", "94 students"],
              ["3:30 PM", "Microbiology Q&A", "72 students"],
              ["7:30 PM", "Clinical Biochemistry Live", "186 students"],
            ].map((x) => (
              <div key={x[0]} className="mt-4 border-l-2 border-brand pl-4">
                <p className="text-xs font-bold text-brand">{x[0]}</p>
                <p className="text-sm font-semibold">{x[1]}</p>
                <p className="text-xs text-muted">{x[2]}</p>
              </div>
            ))}
            <div className="mt-6 grid grid-cols-2 gap-4 border-t pt-5">
              <Stat label="Enrollments" value="18" detail="today" />
              <Stat label="Submitted" value="214" detail="assessments" />
            </div>
          </section>
          <section className={`${panel} p-5`}>
            <h2 className="font-bold">Teacher Activity</h2>
            <p className="mt-4 font-bold">Dr. Sarah Ahmed</p>
            <p className="text-sm text-muted">3 Courses • 284 Students</p>
            <p className="mt-3 text-sm">4 Classes This Month</p>
            <p className="text-sm">72% Avg Student Progress</p>
          </section>
          <section className={`${panel} p-5`}>
            <h2 className="font-bold">Platform Activity</h2>
            {[
              "Student enrolled in Clinical Biochemistry",
              "Teacher published Module 04",
              "Certificate issued",
              "Assessment published",
            ].map((x) => (
              <p className="mt-3 text-sm" key={x}>
                • {x}
              </p>
            ))}
          </section>
        </aside>
      </div>
    </>
  );
}
function Attention() {
  const items = [
    {
      title: "Enrollment approvals",
      detail: "28 students waiting",
      action: "Review",
      href: "/admin/students",
      icon: UserRoundCheck,
      iconStyle: "bg-brand/8 text-brand",
      featured: true,
    },
    {
      title: "Teacher profiles",
      detail: "4 incomplete",
      action: "View",
      href: "/admin/teachers",
      icon: CircleUserRound,
      iconStyle: "bg-purple/8 text-purple",
    },
    {
      title: "Course publishing",
      detail: "3 modules unpublished",
      action: "Review",
      href: "/admin/courses",
      icon: BookOpenCheck,
      iconStyle: "bg-deep-blue/8 text-deep-blue",
    },
    {
      title: "Support requests",
      detail: "12 open",
      action: "Open",
      href: "/admin/support",
      icon: Headphones,
      iconStyle: "bg-amber-50 text-amber-700",
    },
  ];
  return (
    <section className={`${panel} overflow-hidden p-4 sm:p-5`}>
      <div className="flex items-center justify-between gap-3 pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand/8 text-brand">
            <AlertTriangle size={18} aria-hidden="true" />
          </span>
          <h2 className="text-lg font-bold">Needs Attention</h2>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-muted">
          {items.length} items
        </span>
      </div>
      <div className="divide-y divide-[#f0e4e8]">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.title}
              href={item.href}
              className={`group flex min-h-[70px] items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-[#fbf7f9] focus-visible:bg-[#fbf7f9] ${item.featured ? "bg-brand/[.035]" : ""}`}
              aria-label={`${item.title}: ${item.detail}. ${item.action}`}
            >
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${item.iconStyle}`}
              >
                <Icon size={18} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-[15px] leading-tight">
                  {item.title}
                </strong>
                <span className="mt-1 block text-sm leading-tight text-muted">
                  {item.detail}
                </span>
              </span>
              <span className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-brand sm:inline-flex">
                {item.action}
                <ChevronRight size={16} aria-hidden="true" />
              </span>
              <ChevronRight
                className="shrink-0 text-brand transition-transform group-hover:translate-x-0.5 sm:hidden"
                size={18}
                aria-hidden="true"
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
function Growth() {
  const [range, setRange] = useState("30 Days");
  return (
    <section className={`${panel} p-5`}>
      <div className="flex justify-between">
        <h2 className="text-lg font-bold">Student Growth</h2>
        <select
          className="rounded border px-2 text-xs"
          value={range}
          onChange={(e) => setRange(e.target.value)}
        >
          <option>7 Days</option>
          <option>30 Days</option>
          <option>3 Months</option>
          <option>12 Months</option>
        </select>
      </div>
      <svg
        viewBox="0 0 300 120"
        className="mt-5 w-full"
        role="img"
        aria-label="Student growth rising over time"
      >
        <path
          d="M5 105 C45 98 55 78 92 82 S145 45 180 60 S230 25 295 18"
          fill="none"
          stroke="#A4226C"
          strokeWidth="5"
        />
        <path
          d="M5 105 C45 98 55 78 92 82 S145 45 180 60 S230 25 295 18 L295 120 L5 120Z"
          fill="#A4226C18"
        />
      </svg>
    </section>
  );
}
function CoursePerformance() {
  return (
    <section className={`${panel} p-5`}>
      <div className="flex justify-between">
        <h2 className="text-lg font-bold">Course Performance</h2>
        <Link
          href="/admin/reports/courses"
          className="text-sm font-bold text-brand"
        >
          View analytics
        </Link>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {teacherCourses.slice(0, 2).map((c) => (
          <div key={c.id} className="rounded border p-4">
            <b>{c.title}</b>
            <p className="mt-2 text-xs text-muted">
              {c.students} students • {c.progress}% avg progress
            </p>
            <div className="mt-3 h-2 rounded bg-slate-100">
              <div
                className="h-full rounded bg-brand"
                style={{ width: `${c.progress}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
type Row = Record<string, React.ReactNode> & { id: string };
function DataView({
  rows,
  columns,
  base,
  search = "Search...",
  total = "1–25 of 1,284",
}: {
  rows: Row[];
  columns: string[];
  base: string;
  search?: string;
  total?: string;
}) {
  const [q, setQ] = useState("");
  const filtered = rows.filter((r) =>
    Object.values(r).some((v) =>
      String(v).toLowerCase().includes(q.toLowerCase()),
    ),
  );
  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-3" size={17} />
          <span className="sr-only">{search}</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={`${input} pl-10`}
            placeholder={search}
          />
        </label>
        <select
          className="min-h-11 rounded border bg-white px-3 text-sm"
          aria-label="Status filter"
        >
          <option>All Statuses</option>
          <option>Active</option>
          <option>Pending</option>
        </select>
        <button className={secondary}>Filters</button>
      </div>
      <div className={`${panel} hidden overflow-hidden md:block`}>
        <table className="w-full text-left text-sm">
          <thead className="bg-deep-blue text-white">
            <tr>
              {columns.map((c) => (
                <th className="px-4 py-3" key={c}>
                  {c}
                </th>
              ))}
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr className="border-t border-[#ead1da]" key={r.id}>
                {columns.map((c) => (
                  <td className="px-4 py-3" key={c}>
                    {r[c]}
                  </td>
                ))}
                <td className="px-4 py-3">
                  <Link
                    href={`${base}/${r.id}`}
                    className="font-bold text-brand"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 md:hidden">
        {filtered.map((r) => (
          <Link href={`${base}/${r.id}`} key={r.id} className={`${panel} p-4`}>
            <div className="flex justify-between">
              <h3 className="font-bold">{r[columns[0]]}</h3>
              {r.Status}
            </div>
            {columns.slice(1, 5).map((c) => (
              <p className="mt-2 text-sm" key={c}>
                <span className="text-muted">{c}: </span>
                {r[c]}
              </p>
            ))}
          </Link>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-muted">
        <span>{total}</span>
        <div className="flex gap-2">
          <button className={secondary}>Previous</button>
          <button className={secondary}>Next</button>
        </div>
      </div>
    </>
  );
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- retained for legacy detail routes
function Students() {
  const rows: Row[] = adminStudents.map((s) => ({
    id: s.id,
    Student: <b>{s.name}</b>,
    Contact: s.email,
    Courses: `${s.courses} Courses`,
    Progress: `${s.progress}%`,
    "Last Active": s.lastActive,
    Status: <Status s={s.status} />,
    Joined: s.joined,
  }));
  return (
    <>
      <Head
        title="Students"
        description="Manage student accounts, enrollments and learning access."
        action={
          <div className="flex gap-2">
            <button className={secondary}>
              <Download />
              Export
            </button>
            <Link className={primary} href="/admin/students/new">
              <Plus />
              Add Student
            </Link>
          </div>
        }
      />
      <DataView
        rows={rows}
        columns={[
          "Student",
          "Contact",
          "Courses",
          "Progress",
          "Last Active",
          "Status",
          "Joined",
        ]}
        base="/admin/students"
        search="Search students..."
      />
    </>
  );
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- retained for legacy detail routes
function Teachers() {
  const rows: Row[] = adminTeachers.map((t) => ({
    id: t.id,
    Teacher: <b>{t.name}</b>,
    Specialization: t.specialization,
    Courses: `${t.courses} Courses`,
    Students: t.students,
    Classes: t.classes,
    Status: <Status s={t.status} />,
    "Last Active": t.lastActive,
  }));
  return (
    <>
      <Head
        title="Teachers"
        description="Manage faculty accounts, assignments and activity."
        action={
          <Link href="/admin/teachers/new" className={primary}>
            <Plus />
            Add Teacher
          </Link>
        }
      />
      <DataView
        rows={rows}
        columns={[
          "Teacher",
          "Specialization",
          "Courses",
          "Students",
          "Classes",
          "Status",
          "Last Active",
        ]}
        base="/admin/teachers"
        search="Search teachers..."
        total="1–18 of 18"
      />
    </>
  );
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- retained for legacy detail routes
function Courses() {
  const rows: Row[] = teacherCourses.map((c) => ({
    id: c.id,
    Course: <b>{c.title}</b>,
    Category: c.category,
    Teacher:
      c.id === "clinical-biochemistry" ? "Dr. Sarah Ahmed" : "Assigned Faculty",
    Students: c.students,
    Modules: c.modules,
    Progress: `${c.progress}%`,
    Status: <Status s={c.status} />,
    Updated: c.updated,
  }));
  return (
    <>
      <Head
        title="Courses"
        description="Manage curriculum, faculty and learner access."
        action={
          <Link href="/admin/courses/new" className={primary}>
            <Plus />
            Create Course
          </Link>
        }
      />
      <DataView
        rows={rows}
        columns={[
          "Course",
          "Category",
          "Teacher",
          "Students",
          "Modules",
          "Progress",
          "Status",
          "Updated",
        ]}
        base="/admin/courses"
        search="Search courses..."
        total="1–24 of 24"
      />
    </>
  );
}
function CreateForm({ kind }: { kind: "Student" | "Teacher" | "Course" }) {
  const [done, setDone] = useState(false);
  if (done)
    return (
      <section className={`${panel} mx-auto max-w-xl p-10 text-center`}>
        <CheckCircle2 className="mx-auto text-green-700" size={48} />
        <h1 className="mt-4 text-2xl font-bold">{kind} Created</h1>
        <Link
          href={`/admin/${kind.toLowerCase()}s`}
          className={`${primary} mt-6`}
        >
          Back to {kind}s
        </Link>
      </section>
    );
  return (
    <>
      <Head
        title={`Add ${kind}`}
        description={`Create a new ${kind.toLowerCase()} record and initial access.`}
      />
      <form
        className={`${panel} grid gap-5 p-5 sm:p-7 md:grid-cols-2`}
        onSubmit={(e) => {
          e.preventDefault();
          setDone(true);
        }}
      >
        {[
          "Full Name",
          "Email",
          "Mobile",
          ...(kind === "Student"
            ? ["Country", "City", "Qualification", "Institution"]
            : kind === "Teacher"
              ? [
                  "Specialization",
                  "Qualification",
                  "Years of Experience",
                  "Bio",
                ]
              : [
                  "Course Title",
                  "Category",
                  "Short Description",
                  "Level",
                  "Estimated Duration",
                  "Assigned Teacher",
                ]),
        ].map((x) => (
          <Field key={x} label={x}>
            <input
              className={input}
              required={!["Mobile", "Bio"].includes(x)}
            />
          </Field>
        ))}
        <Field label="Status">
          <select className={input}>
            <option>{kind === "Course" ? "Draft" : "Active"}</option>
            <option>{kind === "Course" ? "Published" : "Pending"}</option>
          </select>
        </Field>
        <div className="md:col-span-2 flex justify-end gap-2">
          <button type="button" className={secondary}>
            Save & Add Another
          </button>
          <button className={primary}>Create {kind}</button>
        </div>
      </form>
    </>
  );
}
function EntityDetail({ type }: { type: "Student" | "Teacher" | "Course" }) {
  const [tab, setTab] = useState("Overview");
  const [confirm, setConfirm] = useState(false);
  const name =
    type === "Student"
      ? "Ameen Mohammed"
      : type === "Teacher"
        ? "Dr. Sarah Ahmed"
        : "Clinical Biochemistry";
  const tabs =
    type === "Student"
      ? [
          "Overview",
          "Enrollments",
          "Progress",
          "Assessments",
          "Payments",
          "Certificates",
          "Activity",
        ]
      : type === "Teacher"
        ? [
            "Overview",
            "Courses",
            "Classes",
            "Students",
            "Assessments",
            "Activity",
          ]
        : [
            "Overview",
            "Curriculum",
            "Students",
            "Assessments",
            "Live Classes",
            "Resources",
            "Analytics",
            "Settings",
          ];
  return (
    <>
      <Head
        title={name}
        description={
          type === "Student"
            ? "ALS-ST-001284 • Active • Joined 12 Jun 2026"
            : type === "Teacher"
              ? "Clinical Biochemistry Faculty • Active"
              : "Published • Dr. Sarah Ahmed • 186 students"
        }
        action={
          <div className="flex gap-2">
            <button className={secondary}>Edit {type}</button>
            <button className={primary}>
              {type === "Student"
                ? "Manage Enrollment"
                : type === "Teacher"
                  ? "Assign Course"
                  : "Manage Curriculum"}
            </button>
          </div>
        }
      />
      <Tabs items={tabs} active={tab} setActive={setTab} />
      {tab === "Overview" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <section
            className={`${panel} grid grid-cols-2 gap-6 p-5 sm:grid-cols-4`}
          >
            <Stat
              label="Courses"
              value={type === "Course" ? "12 Modules" : "3"}
            />
            <Stat
              label={type === "Teacher" ? "Students" : "Completed"}
              value={type === "Teacher" ? "284" : "1"}
            />
            <Stat
              label={type === "Teacher" ? "Classes" : "Learning Time"}
              value={type === "Teacher" ? "42" : "31h 20m"}
            />
            <Stat label="Average" value="82%" />
          </section>
          <section className={`${panel} p-5`}>
            <h2 className="font-bold">Admin Actions</h2>
            <button className={`${secondary} mt-4 w-full`}>
              Reset Password
            </button>
            <button className={`${secondary} mt-2 w-full`}>
              Send Account Access
            </button>
            <button
              className="mt-2 min-h-10 w-full rounded border border-red-300 text-sm font-bold text-red-700"
              onClick={() => setConfirm(true)}
            >
              {type === "Course"
                ? "Archive Course"
                : type === "Teacher"
                  ? "Deactivate Account"
                  : "Suspend Account"}
            </button>
          </section>
        </div>
      )}
      {tab !== "Overview" && (
        <section className={`${panel} p-5`}>
          <h2 className="text-lg font-bold">{tab}</h2>
          <p className="mt-2 text-sm text-muted">
            Operational {tab.toLowerCase()} records for {name}.
          </p>
          {teacherCourses.slice(0, 3).map((c) => (
            <div
              className="mt-3 flex justify-between rounded border p-3 text-sm"
              key={c.id}
            >
              <span>{c.title}</span>
              <Status s={c.status} />
            </div>
          ))}
        </section>
      )}
      {confirm && (
        <Confirm
          title={`${type === "Course" ? "Archive" : type === "Teacher" ? "Deactivate" : "Suspend"} ${type.toLowerCase()}?`}
          body="This account-impacting action requires confirmation. The frontend demo will not persist it."
          onCancel={() => setConfirm(false)}
          onConfirm={() => setConfirm(false)}
        />
      )}
    </>
  );
}
function Categories() {
  const [items, setItems] = useState([
    "Clinical Science",
    "Microbiology",
    "Hematology",
    "Laboratory Technology",
    "Laboratory Safety",
  ]);
  const [toast, setToast] = useState("");
  function move(i: number, d: number) {
    const n = i + d;
    if (n < 0 || n >= items.length) return;
    const copy = [...items];
    [copy[i], copy[n]] = [copy[n], copy[i]];
    setItems(copy);
  }
  return (
    <>
      <Head
        title="Categories"
        description="Organize courses and catalogue navigation."
        action={
          <button
            className={primary}
            onClick={() => {
              setItems([...items, "New Category"]);
              setToast("Category added");
            }}
          >
            <Plus />
            Add Category
          </button>
        }
      />
      <div className={panel}>
        {items.map((x, i) => (
          <div
            className="flex items-center gap-3 border-b p-4"
            key={`${x}-${i}`}
          >
            <GripVertical />
            <b className="flex-1">{x}</b>
            <span className="text-sm text-muted">
              {[8, 4, 3, 5, 2][i] || 0} courses
            </span>
            <Status s="Active" />
            <button onClick={() => move(i, -1)} aria-label="Move up">
              <ChevronUp />
            </button>
            <button onClick={() => move(i, 1)} aria-label="Move down">
              <ChevronDown />
            </button>
            <button>
              <Edit3 />
            </button>
          </div>
        ))}
      </div>
      {toast && <Toast text={toast} onClose={() => setToast("")} />}
    </>
  );
}
function Batches() {
  const rows: Row[] = batches.map((b) => ({
    id: b.id,
    Batch: <b>{b.id.toUpperCase()}</b>,
    Course: b.course,
    Teacher: b.teacher,
    Students: b.students,
    "Start Date": b.start,
    "End Date": b.end,
    Status: <Status s={b.status} />,
  }));
  return (
    <>
      <Head
        title="Batches"
        description="Manage cohorts, dates and teaching assignments."
        action={
          <Link href="/admin/batches?create=1" className={primary}>
            <Plus />
            Create Batch
          </Link>
        }
      />
      <DataView
        rows={rows}
        columns={[
          "Batch",
          "Course",
          "Teacher",
          "Students",
          "Start Date",
          "End Date",
          "Status",
        ]}
        base="/admin/batches"
        total="1–3 of 3"
      />
    </>
  );
}
function BatchDetail() {
  return (
    <>
      <Head
        title="CB-2026-A"
        description="Clinical Biochemistry • Dr. Sarah Ahmed • Active"
        action={<button className={primary}>Add Students</button>}
      />
      <section className={`${panel} grid grid-cols-2 gap-6 p-5 sm:grid-cols-4`}>
        <Stat label="Students" value="186" />
        <Stat label="Progress" value="72%" />
        <Stat label="Upcoming Classes" value="3" />
        <Stat label="Assessments" value="4" />
      </section>
      <div className="mt-5 flex flex-wrap gap-2">
        <button className={secondary}>Remove Students</button>
        <button className={secondary}>Change Teacher</button>
        <Link href="/admin/live-classes" className={primary}>
          Schedule Class
        </Link>
      </div>
    </>
  );
}
function LiveClasses() {
  const [tab, setTab] = useState("Upcoming");
  return (
    <>
      <Head
        title="Live Classes"
        description="Oversee scheduled and active learning sessions."
        action={
          <Link href="/teacher/live-classes/new" className={primary}>
            <Plus />
            Schedule Class
          </Link>
        }
      />
      <Tabs
        items={["Upcoming", "Live Now", "Completed", "Draft"]}
        active={tab}
        setActive={setTab}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {teacherClasses.map((c) => (
          <article className={`${panel} p-5`} key={c.id}>
            <div className="flex justify-between">
              <Status s={tab === "Live Now" ? "Active" : c.status} />
              <CalendarDays className="text-brand" />
            </div>
            <p className="mt-4 text-xs font-bold text-brand">{c.course}</p>
            <h2 className="mt-1 text-xl font-bold">{c.title}</h2>
            <p className="mt-2 text-sm text-muted">
              Dr. Sarah Ahmed • {c.batch} • {c.date}
            </p>
            <p className="mt-2 text-sm">
              {c.students} students • Resources Ready
            </p>
            <div className="mt-4 flex gap-2">
              <Link href={`/admin/live-classes/${c.id}`} className={primary}>
                View
              </Link>
              <button className={secondary}>Edit</button>
              <button className={secondary}>Cancel</button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
function LiveDetail() {
  return (
    <>
      <Head
        title="Clinical Enzyme Interpretation"
        description="Clinical Biochemistry • Dr. Sarah Ahmed • CB-2026-A"
        action={<button className={secondary}>Edit Details</button>}
      />
      <div className="grid gap-5 lg:grid-cols-3">
        <section className={`${panel} p-5 lg:col-span-2`}>
          <h2 className="font-bold">Class Information</h2>
          <div className="mt-5 grid grid-cols-2 gap-5">
            <Stat label="Audience" value="186" detail="students" />
            <Stat label="Attendance" value="164" />
            <Stat label="Questions" value="12" />
            <Stat label="Resources" value="4" />
          </div>
        </section>
        <section className={`${panel} p-5`}>
          <h2 className="font-bold">Recording Status</h2>
          <p className="mt-3 text-sm">Processing after session</p>
          <button className={`${secondary} mt-4`}>View Attendance</button>
        </section>
      </div>
    </>
  );
}
function Assessments() {
  const [tab, setTab] = useState("Published");
  const rows: Row[] = assessments
    .filter((a) => a.status === tab)
    .map((a) => ({
      id: a.id,
      Assessment: <b>{a.title}</b>,
      Course: a.course,
      Teacher: "Dr. Sarah Ahmed",
      Questions: a.questions,
      Students: a.students,
      Average: a.average ? `${a.average}%` : "—",
      Status: <Status s={a.status} />,
    }));
  return (
    <>
      <Head
        title="Assessments"
        description="Oversee assessment publishing, quality and results."
        action={
          <Link href="/teacher/assessments/new" className={primary}>
            <Plus />
            Create Assessment
          </Link>
        }
      />
      <Tabs
        items={["Published", "Draft", "Completed"]}
        active={tab}
        setActive={setTab}
      />
      <DataView
        rows={rows}
        columns={[
          "Assessment",
          "Course",
          "Teacher",
          "Questions",
          "Students",
          "Average",
          "Status",
        ]}
        base="/admin/assessments"
        total={`1–${rows.length} of ${rows.length}`}
      />
    </>
  );
}
function AssessmentDetail() {
  return (
    <>
      <Head
        title="Clinical Biochemistry Final"
        description="Published • Dr. Sarah Ahmed • 50 questions"
        action={
          <div className="flex gap-2">
            <button className={secondary}>Duplicate</button>
            <Link
              href="/teacher/assessments/clinical-biochemistry-final/results"
              className={primary}
            >
              View Results
            </Link>
          </div>
        }
      />
      <section className={`${panel} grid grid-cols-2 gap-6 p-5 sm:grid-cols-5`}>
        <Stat label="Students" value="186" />
        <Stat label="Completed" value="172" />
        <Stat label="Average" value="81%" />
        <Stat label="Pass Rate" value="88%" />
        <Stat label="Duration" value="60m" />
      </section>
      <div className={`${panel} mt-5 p-5`}>
        <h2 className="font-bold">Assessment Settings</h2>
        <p className="mt-3 text-sm text-muted">
          Results after assessment ends • 1 attempt • Questions and answers
          shuffled
        </p>
      </div>
    </>
  );
}
function QuestionBank() {
  const rows: Row[] = questionBank.map((q) => ({
    id: q.id,
    Question: <b>{q.text}</b>,
    Course: q.course,
    "Created By": "Dr. Sarah Ahmed",
    Topic: q.topic,
    Type: q.type,
    Usage: q.usedIn,
    Status: <Status s="Active" />,
  }));
  return (
    <>
      <Head
        title="Question Bank"
        description="Oversee assessment questions across courses and faculty."
      />
      <DataView
        rows={rows}
        columns={[
          "Question",
          "Course",
          "Created By",
          "Topic",
          "Type",
          "Usage",
          "Status",
        ]}
        base="/admin/question-bank"
        search="Search questions..."
        total="1–4 of 4"
      />
    </>
  );
}
function Payments() {
  const rows: Row[] = payments.map((p) => ({
    id: p.id,
    Transaction: <b>{p.id.toUpperCase()}</b>,
    Student: p.student,
    Course: p.course,
    Amount: `AED ${p.amount}`,
    Method: p.method,
    Status: <Status s={p.status} />,
    Date: p.date,
  }));
  return (
    <>
      <Head
        title="Payments"
        description="Track course payments and manual records."
        action={
          <Link href="/admin/payments/new" className={primary}>
            <Plus />
            Record Payment
          </Link>
        }
      />
      <section
        className={`${panel} mb-5 grid grid-cols-2 gap-6 p-5 sm:grid-cols-4`}
      >
        <Stat label="Total Collected" value="AED 128,450" />
        <Stat label="Pending" value="AED 8,200" />
        <Stat label="Refunded" value="AED 1,250" />
        <Stat label="Transactions" value="342" />
      </section>
      <DataView
        rows={rows}
        columns={[
          "Transaction",
          "Student",
          "Course",
          "Amount",
          "Method",
          "Status",
          "Date",
        ]}
        base="/admin/payments"
        total="1–25 of 342"
      />
    </>
  );
}
function PaymentDetail() {
  const [toast, setToast] = useState("");
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <Head
        title="ALS-PAY-001284"
        description="Payment transaction detail"
        action={
          <button
            className={primary}
            onClick={() => setToast("Payment marked paid")}
          >
            Mark Paid
          </button>
        }
      />
      <section className={`${panel} grid gap-5 p-5 sm:grid-cols-2`}>
        {[
          ["Student", "Ameen Mohammed"],
          ["Course", "Clinical Biochemistry"],
          ["Amount", "AED 450"],
          ["Method", "Online"],
          ["Reference", "ALS-GW-882194"],
          ["Status", "Paid"],
          ["Date", "28 Aug 2026"],
          ["Notes", "Course enrollment payment"],
        ].map((x) => (
          <div key={x[0]}>
            <p className="text-xs font-bold text-muted">{x[0]}</p>
            <p className="mt-1 font-semibold">{x[1]}</p>
          </div>
        ))}
      </section>
      <div className="mt-5 flex gap-2">
        <button className={secondary} onClick={() => setConfirm(true)}>
          Refund
        </button>
        <button className={secondary}>
          <Download />
          Download Receipt
        </button>
      </div>
      {confirm && (
        <Confirm
          title="Refund payment?"
          body="This frontend confirmation does not contact a payment provider."
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            setToast("Refund request recorded");
          }}
        />
      )}
      {toast && <Toast text={toast} onClose={() => setToast("")} />}
    </>
  );
}
function PaymentForm() {
  const [done, setDone] = useState(false);
  return done ? (
    <section className={`${panel} mx-auto max-w-xl p-10 text-center`}>
      <CheckCircle2 className="mx-auto text-green-700" size={48} />
      <h1 className="mt-4 text-2xl font-bold">Payment Recorded</h1>
      <Link href="/admin/payments" className={`${primary} mt-6`}>
        View Payments
      </Link>
    </section>
  ) : (
    <>
      <Head
        title="Record Manual Payment"
        description="Add an offline or reconciled course payment."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setDone(true);
        }}
        className={`${panel} grid gap-5 p-5 sm:grid-cols-2 sm:p-7`}
      >
        {["Student", "Course", "Amount", "Method", "Reference", "Date"].map(
          (x) => (
            <Field key={x} label={x}>
              <input
                required
                className={input}
                type={
                  x === "Date" ? "date" : x === "Amount" ? "number" : "text"
                }
              />
            </Field>
          ),
        )}
        <div className="sm:col-span-2">
          <Field label="Notes">
            <textarea className={`${input} min-h-28 py-3`} />
          </Field>
        </div>
        <div className="sm:col-span-2 flex justify-end">
          <button className={primary}>Record Payment</button>
        </div>
      </form>
    </>
  );
}
function Certificates() {
  const [confirm, setConfirm] = useState(false);
  const rows: Row[] = certificates.map((c) => ({
    id: c.id,
    Student: <b>{c.student}</b>,
    Course: c.course,
    "Certificate ID": c.id,
    Completed: c.completed,
    Issued: c.issued,
    Status: <Status s={c.status} />,
  }));
  return (
    <>
      <Head
        title="Certificates"
        description="Issue, verify and revoke ALS course credentials."
        action={<button className={primary}>Issue Selected</button>}
      />
      <DataView
        rows={rows}
        columns={[
          "Student",
          "Course",
          "Certificate ID",
          "Completed",
          "Issued",
          "Status",
        ]}
        base="/admin/certificates"
        total="1–2 of 2"
      />
      <section className={`${panel} mt-6 grid gap-5 p-5 sm:grid-cols-2`}>
        <Field label="Authorized Signatory">
          <input className={input} defaultValue="Dr. Sarah Ahmed" />
        </Field>
        <Field label="Certificate Prefix">
          <input className={input} defaultValue="ALS-CERT" />
        </Field>
        <Field label="Verification URL">
          <input className={input} defaultValue="verify.als.academy" />
        </Field>
        <button className={secondary} onClick={() => setConfirm(true)}>
          Revoke Certificate
        </button>
      </section>
      {confirm && (
        <Confirm
          title="Revoke certificate?"
          body="The credential will be marked revoked after backend connection."
          onCancel={() => setConfirm(false)}
          onConfirm={() => setConfirm(false)}
        />
      )}
    </>
  );
}
function Notifications() {
  const [tab, setTab] = useState("Sent");
  const status = tab === "Sent" ? "Published" : tab;
  return (
    <>
      <Head
        title="Notification Center"
        description="Create and review platform communication."
        action={
          <Link href="/admin/notifications/new" className={primary}>
            <Plus />
            Create Notification
          </Link>
        }
      />
      <Tabs
        items={["Sent", "Scheduled", "Draft"]}
        active={tab}
        setActive={setTab}
      />
      <DataView
        rows={[
          {
            id: "welcome",
            Title: <b>Welcome to ALS</b>,
            Audience: "All Students",
            Channel: "In-App",
            Recipients: "1,284",
            Delivered: "1,270",
            Failed: "14",
            Date: "28 Aug 2026",
            Status: <Status s={status} />,
          },
        ]}
        columns={[
          "Title",
          "Audience",
          "Channel",
          "Recipients",
          "Delivered",
          "Failed",
          "Date",
          "Status",
        ]}
        base="/admin/notifications"
        total="1–1 of 1"
      />
    </>
  );
}
function NotificationForm() {
  const [done, setDone] = useState(false);
  return done ? (
    <section className={`${panel} mx-auto max-w-xl p-10 text-center`}>
      <CheckCircle2 className="mx-auto text-green-700" size={48} />
      <h1 className="mt-4 text-2xl font-bold">Notification Scheduled</h1>
    </section>
  ) : (
    <>
      <Head
        title="Create Notification"
        description="Send an in-app notification or prepare external delivery."
      />
      <form
        className={`${panel} space-y-5 p-5 sm:p-7`}
        onSubmit={(e) => {
          e.preventDefault();
          setDone(true);
        }}
      >
        <Field label="Title">
          <input className={input} required />
        </Field>
        <Field label="Message">
          <textarea className={`${input} min-h-28 py-3`} required />
        </Field>
        <Field label="Audience">
          <select className={input}>
            <option>All Students</option>
            <option>All Teachers</option>
            <option>Specific Course</option>
            <option>Specific Batch</option>
          </select>
        </Field>
        <fieldset>
          <legend className="text-xs font-bold uppercase text-muted">
            Channels
          </legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[
              ["In-App", "Configured"],
              ["Email", "Not Configured"],
              ["WhatsApp", "Not Configured"],
              ["SMS", "Not Configured"],
            ].map((x) => (
              <label
                className="flex items-center justify-between rounded border p-3 text-sm"
                key={x[0]}
              >
                <span>
                  <input
                    type="checkbox"
                    disabled={x[1] !== "Configured"}
                    defaultChecked={x[1] === "Configured"}
                  />{" "}
                  {x[0]}
                </span>
                <Status s={x[1]} />
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex justify-end gap-2">
          <button type="button" className={secondary}>
            Save Draft
          </button>
          <button className={primary}>Send / Schedule</button>
        </div>
      </form>
    </>
  );
}
function Announcements() {
  const [items, setItems] = useState([
    "Platform maintenance notice",
    "New Clinical Biochemistry intake",
  ]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState("");
  return (
    <>
      <Head
        title="Announcements"
        description="Publish global and targeted platform updates."
        action={
          <button className={primary} onClick={() => setOpen(true)}>
            <Plus />
            New Announcement
          </button>
        }
      />
      <div className="space-y-3">
        {items.map((x, i) => (
          <article className={`${panel} p-5`} key={x}>
            <div className="flex justify-between">
              <div>
                <h2 className="font-bold">{x}</h2>
                <p className="mt-2 text-sm text-muted">
                  {i ? "Students • Clinical Biochemistry" : "Everyone"} • Today
                </p>
              </div>
              <Status s="Published" />
            </div>
            <div className="mt-4 flex gap-3 text-sm font-bold text-brand">
              <button>Edit</button>
              <button>Unpublish</button>
            </div>
          </article>
        ))}
      </div>
      {open && (
        <div className="fixed inset-0 z-60 grid place-items-center bg-black/40 p-4">
          <form
            className={`${panel} w-full max-w-xl space-y-4 p-6`}
            onSubmit={(e) => {
              e.preventDefault();
              setItems(["New ALS announcement", ...items]);
              setOpen(false);
              setToast("Announcement published");
            }}
          >
            <h2 className="text-xl font-bold">New Announcement</h2>
            <Field label="Title">
              <input className={input} required />
            </Field>
            <Field label="Message">
              <textarea className={`${input} min-h-28 py-3`} required />
            </Field>
            <Field label="Audience">
              <select className={input}>
                <option>Everyone</option>
                <option>Students</option>
                <option>Teachers</option>
                <option>Course</option>
                <option>Batch</option>
              </select>
            </Field>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={secondary}
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button className={primary}>Publish</button>
            </div>
          </form>
        </div>
      )}
      {toast && <Toast text={toast} onClose={() => setToast("")} />}
    </>
  );
}
const reportNames = [
  "Student Enrollment",
  "Course Progress",
  "Student Activity",
  "Assessment Performance",
  "Live Class Attendance",
  "Teacher Activity",
  "Payment Collection",
  "Certificate Issuance",
];
function Reports({ type }: { type?: string }) {
  const [toast, setToast] = useState("");
  if (!type)
    return (
      <>
        <Head
          title="Reports"
          description="Operational reporting across learning, attendance and finance."
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {reportNames.map((x, i) => (
            <Link
              href={`/admin/reports/${["students", "courses", "students", "assessments", "attendance", "teachers", "payments", "certificates"][i]}`}
              className={`${panel} p-5`}
              key={x}
            >
              <BarChart3 className="text-brand" />
              <h2 className="mt-4 font-bold">{x} Report</h2>
              <p className="mt-2 text-sm text-muted">
                View filters, summaries and detailed records.
              </p>
            </Link>
          ))}
        </div>
      </>
    );
  const title = `${type[0].toUpperCase() + type.slice(1)} Report`;
  return (
    <>
      <Head
        title={title}
        description="Filter and export operational report data."
        action={
          <div className="flex gap-2">
            <button
              className={secondary}
              onClick={() => setToast("CSV export prepared")}
            >
              CSV
            </button>
            <button
              className={secondary}
              onClick={() => setToast("Excel export prepared")}
            >
              Excel
            </button>
            <button
              className={secondary}
              onClick={() => setToast("PDF export prepared")}
            >
              PDF
            </button>
          </div>
        }
      />
      <div className={`${panel} mb-5 grid gap-5 p-5 sm:grid-cols-4`}>
        <Stat label="Records" value="1,284" />
        <Stat label="Active" value="1,036" />
        <Stat label="Average" value="72%" />
        <Stat label="Change" value="+8.4%" />
      </div>
      <section className={`${panel} p-5`}>
        <h2 className="font-bold">Overview</h2>
        <div className="mt-5 flex h-44 items-end gap-3">
          {[35, 52, 41, 68, 75, 62, 91, 78].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-deep-blue"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </section>
      <div className={`${panel} mt-5 p-5`}>
        <h2 className="font-bold">Detailed Records</h2>
        {teacherCourses.map((c) => (
          <div
            className="mt-3 grid grid-cols-3 border-t pt-3 text-sm"
            key={c.id}
          >
            <span>{c.title}</span>
            <span>{c.students} students</span>
            <span>{c.progress}% progress</span>
          </div>
        ))}
      </div>
      {toast && <Toast text={toast} onClose={() => setToast("")} />}
    </>
  );
}
function ActivityLog() {
  const rows: Row[] = auditEvents.map((e) => ({
    id: e.id,
    Date: e.date,
    User: e.user,
    Action: e.action,
    Entity: e.entity,
    Details: e.details,
  }));
  return (
    <>
      <Head
        title="Activity & Audit Log"
        description="Review important platform changes and administrative actions."
      />
      <DataView
        rows={rows}
        columns={["Date", "User", "Action", "Entity", "Details"]}
        base="/admin/activity"
        total="1–3 of 3"
      />
    </>
  );
}
function Support() {
  const [tab, setTab] = useState("Open");
  const rows: Row[] = supportTickets
    .filter((t) => t.status === tab)
    .map((t) => ({
      id: t.id,
      Ticket: <b>{t.id.toUpperCase()}</b>,
      User: t.user,
      Role: t.role,
      Topic: t.topic,
      Priority: t.priority,
      Status: <Status s={t.status} />,
      Created: t.created,
    }));
  return (
    <>
      <Head
        title="Support"
        description="Triage and resolve student and teacher requests."
      />
      <Tabs
        items={["Open", "In Progress", "Resolved"]}
        active={tab}
        setActive={setTab}
      />
      <DataView
        rows={rows}
        columns={[
          "Ticket",
          "User",
          "Role",
          "Topic",
          "Priority",
          "Status",
          "Created",
        ]}
        base="/admin/support"
        total={`1–${rows.length} of ${rows.length}`}
      />
    </>
  );
}
function SupportDetail() {
  const [status, setStatus] = useState("Open");
  const [toast, setToast] = useState("");
  return (
    <>
      <Head
        title="ALS-SUP-1284"
        description="Ameen Mohammed • Student • High priority"
        action={<Status s={status} />}
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className={`${panel} p-5`}>
          <h2 className="font-bold">Course progress not updating</h2>
          <div className="mt-5 space-y-4">
            <p className="rounded bg-[#faf8ff] p-4 text-sm">
              <b>Ameen:</b> My completed lesson is still showing incomplete.
            </p>
            <p className="rounded bg-brand/5 p-4 text-sm">
              <b>ALS Support:</b> We are reviewing your progress record.
            </p>
          </div>
          <textarea
            className={`${input} mt-5 min-h-28 py-3`}
            placeholder="Write a reply..."
          />
          <button
            className={`${primary} mt-3`}
            onClick={() => setToast("Reply added")}
          >
            Reply
          </button>
        </section>
        <aside className={`${panel} p-5`}>
          <Field label="Assigned To">
            <select className={input}>
              <option>ALS Admin</option>
              <option>Support Team</option>
            </select>
          </Field>
          <div className="mt-4">
            <Field label="Status">
              <select
                className={input}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option>Open</option>
                <option>In Progress</option>
                <option>Resolved</option>
              </select>
            </Field>
          </div>
          <button
            className={`${primary} mt-5 w-full`}
            onClick={() => {
              setStatus("Resolved");
              setToast("Ticket resolved");
            }}
          >
            Resolve
          </button>
        </aside>
      </div>
      {toast && <Toast text={toast} onClose={() => setToast("")} />}
    </>
  );
}
function Cms() {
  const [items, setItems] = useState(cmsSections);
  const [toast, setToast] = useState("");
  function move(i: number, d: number) {
    const n = i + d;
    if (n < 0 || n >= items.length) return;
    const copy = [...items];
    [copy[i], copy[n]] = [copy[n], copy[i]];
    setItems(copy);
  }
  return (
    <>
      <Head
        title="Website / CMS"
        description="Manage public homepage sections and visibility."
        action={
          <Link href="/" className={secondary}>
            <Eye />
            Preview Website
          </Link>
        }
      />
      <div className={panel}>
        {items.map((s, i) => (
          <div className="flex items-center gap-3 border-b p-4" key={s.id}>
            <GripVertical />
            <b className="flex-1">{s.name}</b>
            <label className="text-xs">
              <input
                type="checkbox"
                checked={s.visible}
                onChange={() =>
                  setItems(
                    items.map((x) =>
                      x.id === s.id ? { ...x, visible: !x.visible } : x,
                    ),
                  )
                }
              />{" "}
              Visible
            </label>
            <button onClick={() => move(i, -1)}>
              <ChevronUp />
            </button>
            <button onClick={() => move(i, 1)}>
              <ChevronDown />
            </button>
            <button onClick={() => setToast(`${s.name} editor opened`)}>
              <Edit3 />
            </button>
          </div>
        ))}
      </div>
      <section className={`${panel} mt-5 grid gap-5 p-5 sm:grid-cols-2`}>
        <Field label="Hero Headline">
          <input
            className={input}
            defaultValue="Master Laboratory Science. Build Your Future."
          />
        </Field>
        <Field label="Primary CTA">
          <input className={input} defaultValue="Explore Courses" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Supporting Text">
            <textarea className={`${input} min-h-24 py-3`} />
          </Field>
        </div>
        <button
          className={primary}
          onClick={() => setToast("CMS changes saved")}
        >
          Save Changes
        </button>
      </section>
      {toast && <Toast text={toast} onClose={() => setToast("")} />}
    </>
  );
}
function SettingsPage() {
  const [section, setSection] = useState("General");
  const [toast, setToast] = useState("");
  const sections = [
    "General",
    "Branding",
    "Learning",
    "Payments",
    "Notifications",
    "Certificates",
    "Users & Roles",
    "Security",
    "Integrations",
  ];
  return (
    <>
      <Head
        title="Admin Settings"
        description="Manage academy defaults, integrations and security."
      />
      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <nav className={`${panel} h-fit p-2`}>
          {sections.map((x) => (
            <button
              onClick={() => setSection(x)}
              className={`block min-h-10 w-full rounded px-3 text-left text-sm font-bold ${section === x ? "bg-brand/10 text-brand" : ""}`}
              key={x}
            >
              {x}
            </button>
          ))}
        </nav>
        <section className={`${panel} p-5`}>
          <h2 className="text-xl font-bold">{section}</h2>
          {section === "General" && (
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {[
                ["Academy Name", "Academy for Laboratory Science"],
                ["Email", "admin@als.academy"],
                ["Phone", "+971 50 000 0000"],
                ["Country", "United Arab Emirates"],
                ["Timezone", "Asia/Dubai"],
                ["Support Contact", "support@als.academy"],
              ].map((x) => (
                <Field key={x[0]} label={x[0]}>
                  <input className={input} defaultValue={x[1]} />
                </Field>
              ))}
            </div>
          )}
          {section === "Branding" && (
            <div className="mt-5">
              <p className="text-sm text-muted">
                Official ALS logo and approved brand colors.
              </p>
              <div className="mt-4 flex gap-3">
                <span className="h-12 w-12 bg-brand" />
                <span className="h-12 w-12 bg-purple" />
                <span className="h-12 w-12 bg-deep-blue" />
              </div>
            </div>
          )}
          {["Payments", "Notifications", "Integrations"].includes(section) && (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {["Payment Provider", "Email", "WhatsApp / SMS"].map((x, i) => (
                <div className="rounded border p-4" key={x}>
                  <b>{x}</b>
                  <p className="mt-3">
                    <Status s={i ? "Not Configured" : "Not Configured"} />
                  </p>
                  <button className={`${secondary} mt-4`}>Configure</button>
                </div>
              ))}
            </div>
          )}
          {section === "Users & Roles" && (
            <div className="mt-5 space-y-3">
              {[
                ["Admin", "Full operational control"],
                ["Teacher", "Assigned teaching tools"],
                ["Student", "Learning and account access"],
              ].map((x) => (
                <div className="rounded border p-4" key={x[0]}>
                  <b>{x[0]}</b>
                  <p className="text-sm text-muted">{x[1]}</p>
                </div>
              ))}
            </div>
          )}
          {![
            "General",
            "Branding",
            "Payments",
            "Notifications",
            "Integrations",
            "Users & Roles",
          ].includes(section) && (
            <p className="mt-5 text-sm text-muted">
              Configure platform defaults for {section.toLowerCase()}.
            </p>
          )}
          <button
            className={`${primary} mt-6`}
            onClick={() => setToast("Settings saved")}
          >
            Save Settings
          </button>
        </section>
      </div>
      {toast && <Toast text={toast} onClose={() => setToast("")} />}
    </>
  );
}
function Profile() {
  const [edit, setEdit] = useState(false);
  const [toast, setToast] = useState("");
  return (
    <>
      <Head
        title="Admin Profile"
        description="Administrator account information."
        action={
          <button
            className={edit ? primary : secondary}
            onClick={() => {
              if (edit) setToast("Profile saved");
              setEdit(!edit);
            }}
          >
            {edit ? "Save" : "Edit Profile"}
          </button>
        }
      />
      <section
        className={`${panel} mx-auto grid max-w-3xl gap-5 p-6 sm:grid-cols-[160px_1fr]`}
      >
        <div className="grid h-28 w-28 place-items-center rounded-full bg-deep-blue text-2xl font-bold text-white">
          AA
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name">
            <input
              className={input}
              defaultValue="ALS Admin"
              disabled={!edit}
            />
          </Field>
          <Field label="Email">
            <input
              className={input}
              defaultValue="admin@als.academy"
              disabled={!edit}
            />
          </Field>
          <Field label="Mobile">
            <input
              className={input}
              defaultValue="+971 50 000 0000"
              disabled={!edit}
            />
          </Field>
          <Field label="Role">
            <input className={input} defaultValue="Administrator" disabled />
          </Field>
        </div>
      </section>
      {toast && <Toast text={toast} onClose={() => setToast("")} />}
    </>
  );
}
function Loading() {
  return (
    <div className="space-y-4" aria-label="Loading admin content">
      <div className="skeleton h-10 w-64 rounded" />
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((x) => (
          <div className="skeleton h-32 rounded" key={x} />
        ))}
      </div>
      <div className="skeleton h-80 rounded" />
    </div>
  );
}
function ErrorState() {
  return (
    <section className={`${panel} mx-auto max-w-lg p-8 text-center`}>
      <AlertTriangle className="mx-auto text-amber-600" />
      <h1 className="mt-4 text-xl font-bold">
        We couldn&apos;t load this admin workspace.
      </h1>
      <p className="mt-2 text-sm text-muted">
        No changes were made. Please try again.
      </p>
      <button className={`${primary} mt-5`}>Try Again</button>
    </section>
  );
}
export function AdminPortal() {
  const path = usePathname();
  const query =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : null;
  if (query?.get("state") === "loading")
    return (
      <AdminShell>
        <Loading />
      </AdminShell>
    );
  if (query?.get("state") === "error")
    return (
      <AdminShell>
        <ErrorState />
      </AdminShell>
    );
  let page: React.ReactNode = <Dashboard />;
  if (path === "/admin/students") page = <AdminBackendManager mode="enrollments" />;
  else if (path === "/admin/students/new") page = <CreateForm kind="Student" />;
  else if (path.startsWith("/admin/students/"))
    page = <EntityDetail type="Student" />;
  else if (path === "/admin/teachers") page = <AdminBackendManager mode="faculty" />;
  else if (path === "/admin/teachers/new") page = <CreateForm kind="Teacher" />;
  else if (path.startsWith("/admin/teachers/"))
    page = <EntityDetail type="Teacher" />;
  else if (path === "/admin/courses") page = <AdminBackendManager mode="content" />;
  else if (path === "/admin/courses/new") page = <CreateForm kind="Course" />;
  else if (path.startsWith("/admin/courses/"))
    page = <EntityDetail type="Course" />;
  else if (path === "/admin/categories") page = <Categories />;
  else if (path === "/admin/batches") page = <Batches />;
  else if (path.startsWith("/admin/batches/")) page = <BatchDetail />;
  else if (path === "/admin/live-classes") page = <LiveClasses />;
  else if (path.startsWith("/admin/live-classes/")) page = <LiveDetail />;
  else if (path === "/admin/assessments") page = <Assessments />;
  else if (path.startsWith("/admin/assessments/")) page = <AssessmentDetail />;
  else if (path === "/admin/question-bank") page = <QuestionBank />;
  else if (path === "/admin/academic") page = <AcademicWorkspaceManager />;
  else if (path === "/admin/questions") page = <AcademicWorkspaceManager section="questions" />;
  else if (path === "/admin/tests") page = <AdminBackendManager mode="tests" />;
  else if (path === "/admin/live-learning") page = <AdminBackendManager mode="checkpoints" />;
  else if (path === "/admin/payments") page = <Payments />;
  else if (path === "/admin/payments/new") page = <PaymentForm />;
  else if (path.startsWith("/admin/payments/")) page = <PaymentDetail />;
  else if (path === "/admin/certificates") page = <Certificates />;
  else if (path === "/admin/notifications") page = <Notifications />;
  else if (path === "/admin/notifications/new") page = <NotificationForm />;
  else if (path === "/admin/announcements") page = <Announcements />;
  else if (path === "/admin/reports") page = <Reports />;
  else if (path.startsWith("/admin/reports/"))
    page = <Reports type={path.split("/").pop()} />;
  else if (path === "/admin/activity") page = <ActivityLog />;
  else if (path === "/admin/support") page = <Support />;
  else if (path.startsWith("/admin/support/")) page = <SupportDetail />;
  else if (path === "/admin/cms") page = <Cms />;
  else if (path === "/admin/settings") page = <SettingsPage />;
  else if (path === "/admin/profile") page = <Profile />;
  return <AdminShell>{page}</AdminShell>;
}
