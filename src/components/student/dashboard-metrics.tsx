import { BookOpen, CalendarDays, FileCheck2, Video } from "lucide-react";
export function DashboardMetrics({ programs, sessions, tests, recordings }: { programs: number; sessions: number; tests: number; recordings: number }) {
  const metrics = [{ icon: BookOpen, value: programs, label: "Active programs" }, { icon: CalendarDays, value: sessions, label: "Upcoming classes" }, { icon: FileCheck2, value: tests, label: "Available tests" }, { icon: Video, value: recordings, label: "Recorded classes" }];
  return <section aria-label="Learning overview" className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{metrics.map(({ icon: Icon, value, label }) => <div key={label} className="min-w-0 rounded-xl border border-line bg-white p-3 sm:p-4"><Icon size={22} aria-hidden="true" className="text-brand"/><strong className="mt-2 block text-2xl font-bold tabular-nums">{value}</strong><p className="mt-1 text-xs leading-5 text-muted sm:text-sm">{label}</p></div>)}</section>;
}
