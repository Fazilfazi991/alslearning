import { NextResponse } from "next/server";
import { adminSession } from "@/lib/admin-session";
import { isSameOriginRequest } from "@/lib/request-origin";
import { validAccountId,validAccountName } from "@/lib/account-validation";
import { validProfilePhone } from "@/lib/student-profile";
import { createAuthAdminClient } from "@/lib/supabase/admin";
const headers={"Cache-Control":"private, no-store"};
export async function GET(_request:Request,context:RouteContext<"/api/admin/students/[id]">) {
  const s=await adminSession();if(s.response)return s.response;
  const {id}=await context.params;if(!validAccountId(id))return NextResponse.json({error:"Invalid student."},{status:400});
  const db=s.db!;
  const [profile,enrollments,history,attendance,results,transfers]=await Promise.all([
    db.from("profiles").select("id,full_name,email,phone,avatar_path,role,is_active,student_code,admission_on,created_at,guardian_name,guardian_phone,guardian_relationship,address,internal_notes").eq("id",id).eq("role","student").single(),
    db.from("enrollments").select("id,program_id,batch_id,status,enrolled_on,access_starts_at,access_expires_at,programs(name),batches(name,batch_code)").eq("student_id",id).order("created_at"),
    db.from("student_batch_history").select("id,enrollment_id,effective_at,ended_at,reason,programs(name),batches(name,batch_code)").eq("student_id",id).order("effective_at",{ascending:false}),
    db.from("live_attendance_intervals").select("id,session_id,started_at,ended_at").eq("user_id",id),
    db.from("test_attempts").select("id,status,score,submitted_at,tests(title)").eq("student_id",id).order("started_at",{ascending:false}),
    db.from("student_batch_transfers").select("id,effective_at,status,reason,failure_reason,batches!student_batch_transfers_to_batch_id_fkey(name,batch_code)").eq("student_id",id).order("effective_at",{ascending:false})
  ]);
  if(profile.error)return NextResponse.json({error:"Student not found."},{status:404});
  if([enrollments,history,attendance,results,transfers].some(r=>r.error))return NextResponse.json({error:"Student details could not be loaded."},{status:503});
  const photo=profile.data.avatar_path?await db.storage.from("profile-photos").createSignedUrl(profile.data.avatar_path,300):null;
  // Whitelist the one safe Auth field, never return the admin Auth object.
  let last_sign_in_at:string|null=null;
  try{last_sign_in_at=(await createAuthAdminClient().auth.admin.getUserById(id)).data.user?.last_sign_in_at??null;}catch{/* Account status remains available without Auth administration. */}
  return NextResponse.json({profile:{...profile.data,photo_url:photo?.data?.signedUrl??null,last_sign_in_at},enrollments:enrollments.data,history:history.data,attendance:attendance.data,results:results.data,transfers:transfers.data},{headers});
}
export async function PATCH(request:Request,context:RouteContext<"/api/admin/students/[id]">) {
  if(!isSameOriginRequest(request))return NextResponse.json({error:"Invalid request."},{status:403});
  const s=await adminSession();if(s.response)return s.response;
  const {id}=await context.params;
  let body:Record<string,unknown>;try{body=await request.json();if(!body || typeof body!=="object" || Array.isArray(body))throw Error();}catch{return NextResponse.json({error:"Invalid form."},{status:400});}
  if(!validAccountId(id))return NextResponse.json({error:"Invalid student."},{status:400});
  const allowed=["full_name","phone","guardian_name","guardian_phone","guardian_relationship","address","internal_notes","is_active"];
  if(!Object.keys(body).length || Object.keys(body).some(k=>!allowed.includes(k)) || (body.full_name!==undefined && !validAccountName(body.full_name)) || (body.phone!==undefined && !validProfilePhone(body.phone)) || (body.guardian_phone!==undefined && !validProfilePhone(body.guardian_phone)) || (body.is_active!==undefined && typeof body.is_active!=="boolean"))return NextResponse.json({error:"Check the student fields. Identity, email and program changes are separate actions."},{status:400});
  for(const [key,max] of Object.entries({guardian_name:120,guardian_phone:32,guardian_relationship:80,address:1000,internal_notes:4000}))if(body[key]!==undefined && (typeof body[key]!=="string" || (body[key] as string).length>max))return NextResponse.json({error:`Invalid ${key.replaceAll("_"," ")}.`},{status:400});
  const current=await s.db!.from("profiles").select("id,is_active").eq("id",id).eq("role","student").single();
  if(!current.data)return NextResponse.json({error:"Student not found."},{status:404});
  const updated=await s.db!.from("profiles").update({...body,updated_at:new Date().toISOString()}).eq("id",id).eq("role","student").select("id").single();
  if(updated.error || !updated.data)return NextResponse.json({error:"Student changes were not saved."},{status:422});
  return NextResponse.json({success:true},{headers});
}
