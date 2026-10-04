export type StudentAttempt = {
  id: string;
  test_id: string;
  test_title?: string;
  status: string;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  total_marks: number | null;
};

export type CatalogTest = {
  id: string;
  slug: string;
  title: string;
  state: "available" | "in_progress" | "completed" | "upcoming" | "closed";
};

export type WatchEvent = {
  elapsed_seconds: number;
  ended_at: string;
  content_kind: "lesson" | "recorded_class";
};

type Related<T> = T | T[] | null;
type Enrollment = {
  program_id: string;
  status: string;
  batch_id: string | null;
  access_starts_at: string | null;
  access_expires_at: string | null;
  programs: Related<{ id: string; status: string }>;
  batches: Related<{
    id: string;
    program_id: string;
    status: string;
    access_starts_at: string | null;
    access_expires_at: string | null;
    access_valid_until: string | null;
  }>;
};

export function one<T>(value: Related<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function eligibleStudentEnrollment(
  enrollment: Enrollment,
  now = Date.now(),
  timeZone = "Asia/Dubai",
) {
  const program = one(enrollment.programs);
  const batch = one(enrollment.batches);
  if (!program || program.id !== enrollment.program_id || program.status !== "active" || enrollment.status !== "active") return false;
  if (enrollment.access_starts_at && Date.parse(enrollment.access_starts_at) > now) return false;
  if (enrollment.access_expires_at && Date.parse(enrollment.access_expires_at) <= now) return false;
  if (!enrollment.batch_id) return true;
  if (!batch || batch.program_id !== enrollment.program_id || batch.status !== "active") return false;
  if (batch.access_starts_at && Date.parse(batch.access_starts_at) > now) return false;
  if (batch.access_expires_at && Date.parse(batch.access_expires_at) <= now) return false;
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return !batch.access_valid_until || batch.access_valid_until >= today;
}

export function summarizeStudentTests(tests: CatalogTest[], attempts: StudentAttempt[]) {
  const catalogById = new Map(tests.map(test => [test.id, test]));
  const submitted = attempts.filter(attempt => (attempt.status === "submitted" || attempt.status === "graded")
    && attempt.submitted_at && catalogById.has(attempt.test_id));
  const visibleLatest = new Map<string, StudentAttempt>();
  for (const attempt of submitted) {
    if (!(attempt.score !== null && attempt.total_marks !== null
      && Number.isFinite(Number(attempt.score)) && Number.isFinite(Number(attempt.total_marks))
      && Number(attempt.total_marks) > 0)) continue;
    const previous = visibleLatest.get(attempt.test_id);
    if (!previous || Date.parse(attempt.submitted_at!) > Date.parse(previous.submitted_at!)) visibleLatest.set(attempt.test_id, attempt);
  }
  const visible = [...visibleLatest.values()]
    .sort((a, b) => Date.parse(b.submitted_at!) - Date.parse(a.submitted_at!));
  const earned = visible.reduce((sum, attempt) => sum + Number(attempt.score), 0);
  const possible = visible.reduce((sum, attempt) => sum + Number(attempt.total_marks), 0);
  const submittedIds = new Set(submitted.map(attempt => attempt.test_id));
  return {
    completed: submittedIds.size,
    total: tests.length,
    pending: tests.filter(test => test.state === "available" && !submittedIds.has(test.id)),
    resume: tests.filter(test => test.state === "in_progress"),
    earned,
    possible,
    percentage: possible > 0 ? earned / possible * 100 : null,
    recent: visible.slice(0, 3).map(attempt => ({ ...attempt, slug: catalogById.get(attempt.test_id)?.slug ?? null })),
  };
}

export function summarizeWatchEvents(events: WatchEvent[] | null, now = Date.now(), timeZone = "Asia/Dubai") {
  if (events === null) return null;
  const seconds = events.reduce((sum, event) => sum + Math.max(0, Number(event.elapsed_seconds) || 0), 0);
  const weekly = events.filter(event => {
    const ended = Date.parse(event.ended_at);
    return ended <= now && ended >= now - 7 * 86400000;
  });
  const activeDays = new Set(weekly.map(event => new Intl.DateTimeFormat("sv-SE", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(event.ended_at))));
  return {
    seconds,
    intervals: events.length,
    weeklySeconds: weekly.reduce((sum, event) => sum + Math.max(0, Number(event.elapsed_seconds) || 0), 0),
    weeklyIntervals: weekly.length,
    activeDays: activeDays.size,
  };
}

export function formatWatchTime(seconds: number) {
  if (seconds < 60) return "Under 1 min";
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes} min`;
}
