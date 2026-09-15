import { createClient } from "@/lib/supabase/client";

export type FacultyMember = { id: string; source_key: string | null; full_name: string; is_active: boolean; auth_profile_id: string | null };
export type FacultySubject = { faculty_id: string; subject_id: string };
export type FacultyDirectory = { members: FacultyMember[]; assignments: FacultySubject[]; subjects: { id: string; name: string }[] };

export function subjectNames(memberId: string, directory: FacultyDirectory) {
  const ids = new Set(directory.assignments.filter(a => a.faculty_id === memberId).map(a => a.subject_id));
  return directory.subjects.filter(s => ids.has(s.id)).map(s => s.name);
}

export function facultyCounts(directory: FacultyDirectory) {
  return directory.subjects.map(subject => ({ ...subject, count: directory.assignments.filter(a => a.subject_id === subject.id && directory.members.some(m => m.id === a.faculty_id && m.is_active)).length }));
}

export async function loadFacultyDirectory(): Promise<FacultyDirectory> {
  const db = createClient();
  const [members, assignments, subjects] = await Promise.all([
    db.from("faculty_members").select("id,source_key,full_name,is_active,auth_profile_id").order("full_name"),
    db.from("faculty_subject_assignments").select("faculty_id,subject_id"),
    db.from("subjects").select("id,name").order("name"),
  ]);
  for (const result of [members, assignments, subjects]) if (result.error) throw new Error(result.error.message);
  return { members: members.data || [], assignments: assignments.data || [], subjects: subjects.data || [] };
}

export async function saveFaculty(member: {id: string | null; full_name: string; is_active: boolean}, subjectIds: string[]) {
  const { data, error } = await createClient().rpc("core_save_faculty", {
    target_id: member.id,
    target_name: member.full_name,
    target_active: member.is_active,
    target_subject_ids: subjectIds,
  });
  if (error) throw new Error(error.message);
  return data as string;
}
