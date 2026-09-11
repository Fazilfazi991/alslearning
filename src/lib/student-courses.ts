export type CourseSubject = { id: string; name: string };
export type CourseEnrollment = {
  id: string; status: string; batch_id: string | null;
  access_starts_at: string | null; access_expires_at: string | null;
  batches: { id: string; name: string } | null;
  programs: { id: string; name: string; slug: string } | null;
};
export function activeCourseEnrollment(e: CourseEnrollment, now = Date.now()) {
  return !!e.programs && e.status === "active" && (!e.batch_id || !!e.batches)
    && (!e.access_starts_at || Date.parse(e.access_starts_at) <= now)
    && (!e.access_expires_at || Date.parse(e.access_expires_at) > now);
}
export function selectedCourseSubject(subjects: CourseSubject[], requested?: string) {
  return subjects.find(s => s.id === requested) ?? subjects[0] ?? null;
}
export function courseHasContent(recordings: unknown[], resources: unknown[]) {
  return recordings.length > 0 || resources.length > 0;
}
export function recordingHref(id: string) { return `/student/recorded-classes/${id}`; }
