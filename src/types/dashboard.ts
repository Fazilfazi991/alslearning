export type DashboardData = {
  academic: { students: number; activeStudents: number; activeBatches: number; faculty: number; activePrograms: number; questions: number; tests: number; recordings: number } | null;
  admissions: { total: number; new: number; pending: number; converted: number } | null;
  recentAdmissions: { id: string; full_name: string; student_code: string | null; admission_on: string }[] | null;
  recentEnquiries: { id: string; full_name: string; status: string; created_at: string }[] | null;
  upcomingClasses: { id: string; title: string; starts_at: string; status: string }[] | null;
};
