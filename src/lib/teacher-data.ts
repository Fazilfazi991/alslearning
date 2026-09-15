import "server-only";
import { createClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/auth";

export type TeacherStudent = {
  id: string;
  student_id: string;
  name: string;
  email: string;
  program: string;
  batch: string | null;
  status: string;
  expires_at: string | null;
};
type StudentPage = { total: number; rows: TeacherStudent[] };
function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] || null : value;
}

export async function getTeacherData(section = "dashboard", page = 0, search = "") {
  const user = await currentUser();
  if (!user || user.role !== "teacher") return null;
  const db = await createClient();
  const signal = AbortSignal.timeout(10000);
  const skip = () => Promise.resolve({ data: null, error: null, count: 0 });
  const assignmentsNeeded = ["dashboard", "courses", "profile"].includes(section);
  const rosterNeeded = ["dashboard", "students"].includes(section);
  const [assignments, roster, questions, tests, content, sessions] = await Promise.all([
    assignmentsNeeded
      ? db.from("faculty_assignments").select("id,program_id,subject_id,can_manage_content,can_manage_questions,can_manage_tests,programs(id,name),subjects(id,name),entrance_exams(id,name)").eq("faculty_id", user.id).abortSignal(signal)
      : skip(),
    rosterNeeded
      ? db.rpc("core_teacher_students", { page_number: section === "students" ? page : 0, page_size: section === "students" ? 25 : 1, search_text: section === "students" ? search : "" }).abortSignal(signal)
      : skip(),
    section === "dashboard" ? db.from("questions").select("id", { head: true, count: "exact" }).abortSignal(signal) : skip(),
    section === "dashboard" ? db.from("tests").select("id", { head: true, count: "exact" }).abortSignal(signal) : skip(),
    section === "dashboard" ? db.from("learning_content").select("id", { head: true, count: "exact" }).abortSignal(signal) : skip(),
    section === "live-classes" ? db.from("live_sessions").select("id,title,starts_at,status,provider_room_id").eq("faculty_id", user.id).order("starts_at").abortSignal(signal) : skip(),
  ]);
  const error = [assignments, roster, questions, tests, content, sessions].find((item) => item.error)?.error;
  if (error) throw new Error(error.message);
  const studentPage = (roster.data || { total: 0, rows: [] }) as StudentPage;
  return {
    user,
    assignments: ((assignments.data || []) as NonNullable<typeof assignments.data>).map((item) => ({
      ...item,
      programs: one(item.programs), subjects: one(item.subjects), entrance_exams: one(item.entrance_exams),
    })),
    students: studentPage.rows,
    studentCount: studentPage.total,
    studentPage: page,
    questionCount: questions.count || 0,
    testCount: tests.count || 0,
    contentCount: content.count || 0,
    sessions: sessions.data || [],
  };
}
