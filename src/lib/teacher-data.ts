import"server-only";import{createClient}from"@/lib/supabase/server";import{currentUser}from"@/lib/auth";
function one<T>(value:T|T[]|null):T|null{return Array.isArray(value)?value[0]||null:value}
export async function getTeacherData(section="dashboard"){
  const user=await currentUser();if(!user)return null;
  const db=await createClient(),skip=()=>Promise.resolve({data:[],error:null,count:0});
  const needs=(name:string)=>({dashboard:["assignments","sessions","students","questions"],courses:["assignments"],students:["students"],"live-classes":["sessions"]}as Record<string,string[]>)[section]?.includes(name)||false;
  const[assignments,sessions,questions,enrollmentCount,enrollments]=await Promise.all([
    needs("assignments")?db.from("faculty_assignments").select("id,program_id,subject_id,programs(id,name),subjects(id,name),entrance_exams(id,name)").eq("faculty_id",user.id):skip(),
    needs("sessions")?db.from("live_sessions").select("id,title,starts_at,status,provider_room_id,batches(name),subjects(name)").eq("faculty_id",user.id).order("starts_at"):skip(),
    needs("questions")?db.from("questions").select("id",{head:true,count:"exact"}):skip(),
    section==="dashboard"?db.from("enrollments").select("id",{head:true,count:"exact"}):skip(),
    section==="students"?db.from("enrollments").select("id,status,profiles!enrollments_student_id_fkey(full_name,email),programs(name),batches(name)"):skip(),
  ]);
  const error=[assignments,sessions,questions,enrollmentCount,enrollments].find(x=>x.error)?.error;if(error)throw new Error(error.message);
  return{user,assignments:(assignments.data||[]).map(x=>({...x,programs:one(x.programs),subjects:one(x.subjects),entrance_exams:one(x.entrance_exams)})),sessions:sessions.data||[],questionCount:questions.count||0,studentCount:enrollmentCount.count||0,students:(enrollments.data||[]).map(x=>({...x,profiles:one(x.profiles),programs:one(x.programs),batches:one(x.batches)}))};
}
