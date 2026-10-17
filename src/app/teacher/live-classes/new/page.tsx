import { SessionListRefresh } from "@/components/live/session-list-refresh";
import { TeacherShell } from "@/components/teacher/teacher-shell";
import { ScheduleClass } from "@/components/live/schedule-class";
import { getTeacherData } from "@/lib/teacher-data";
import { createClient } from "@/lib/supabase/server";

type SchedulingBatch = { id:string; name:string; program_id:string; batch_code:string; subject_ids:string[] };
export default async function Page() {
  const data = await getTeacherData("courses");
  if (!data) return null;
  const db = await createClient();
  const [programs, subjects, mappings, batches] = await Promise.all([
    db.from("programs").select("id,name").eq("status", "active"),
    db.from("subjects").select("id,name").eq("status", "active"),
    db.from("program_subjects").select("program_id,subject_id"),
    db.rpc("live_scheduling_batches"),
  ]);
  if ([programs, subjects, mappings, batches].some(result => result.error)) throw new Error("Scheduling options could not be loaded");
  const scopes = (mappings.data || []).flatMap(mapping => {
    const assigned = data.assignments.some(item => (!item.program_id || item.program_id === mapping.program_id) && (!item.subject_id || item.subject_id === mapping.subject_id));
    const program = programs.data?.find(item => item.id === mapping.program_id);
    const subject = subjects.data?.find(item => item.id === mapping.subject_id);
    return assigned && program && subject ? [{ programId: program.id, programName: program.name, subjectId: subject.id, subjectName: subject.name }] : [];
  });
  const choices=((batches.data || []) as SchedulingBatch[]).map(b=>({...b,subjectIds:b.subject_ids}));
  return <TeacherShell title="Schedule live class"><SessionListRefresh/><h1 className="mb-6 text-2xl font-bold">Schedule live class</h1><ScheduleClass scopes={scopes} batches={choices} teacherId={data.user.id} timeZone={process.env.ALS_ACADEMIC_TIME_ZONE || "Asia/Dubai"} /></TeacherShell>;
}
