import { NextResponse } from "next/server";
import { adminSession } from "@/lib/admin-session";
import { createAuthAdminClient } from "@/lib/supabase/admin";
import { admissionErrors, type StudentAdmission } from "@/lib/student-admission";
import { isSameOriginRequest } from "@/lib/request-origin";
const headers={"Cache-Control":"private, no-store"};
export async function GET() {
  const session=await adminSession(); if(session.response)return session.response;
  const [students,programs,batches]=await Promise.all([
    session.db!.from("profiles").select("id,full_name,email,phone,is_active,student_code,admission_on").eq("role","student").order("full_name"),
    session.db!.from("programs").select("id,name,status").eq("status","active").order("name"),
    session.db!.from("batches").select("id,name,program_id,batch_code,status").eq("status","active").order("name")
  ]);
  if([students,programs,batches].some(r=>r.error))return NextResponse.json({error:"Student records could not be loaded."},{status:503});
  return NextResponse.json({students:students.data,programs:programs.data,batches:batches.data},{headers});
}
export async function POST(request:Request) {
  if(!isSameOriginRequest(request))return NextResponse.json({error:"Invalid request."},{status:403});
  const session=await adminSession(); if(session.response)return session.response;
  let body:StudentAdmission;
  try{body=await request.json();if(!body || typeof body!=="object" || Array.isArray(body))throw Error();}catch{return NextResponse.json({error:"Invalid admission form."},{status:400});}
  const errors=admissionErrors(body);
  if(Object.keys(errors).length)return NextResponse.json({error:"Check the highlighted fields.",errors},{status:400});
  // The Auth DB trigger completes admission in the SAME transaction. A trigger
  // failure rolls back Auth too; no success message or orphan login is possible.
  const {password,email,...admission}=body;
  try {
    const root=createAuthAdminClient();
    const result=await root.auth.admin.createUser({email:email.trim().toLowerCase(),password,email_confirm:true,
      app_metadata:{role:"student",lms_admission:{...admission,actor_id:session.user!.id}},user_metadata:{full_name:body.full_name.trim()}});
    if(result.error || !result.data.user) {
      const duplicate=/already|exists|registered/i.test(result.error?.code??"") || /already.*registered|already.*exists/i.test(result.error?.message??"");
      return NextResponse.json({error:duplicate?"An account already uses this email.":"Admission was not completed. Check Program, Batch Code and access dates; no partial admission was accepted."},{status:duplicate?409:422});
    }
    const verified=await session.db!.from("profiles").select("id,student_code,phone,admission_on").eq("id",result.data.user.id).single();
    if(verified.error || !verified.data?.admission_on || (!body.unassigned && !verified.data.student_code)) {
      // Defense against deploying the application before its required trigger.
      // Only this newly created, unadmitted identity is eligible for compensation.
      const removed=await root.auth.admin.deleteUser(result.data.user.id);
      return NextResponse.json({error:removed.error?"Admission requires administrator recovery; do not retry creating another account for this email.":"Admission is unavailable until its database migration is installed. The incomplete new login was removed."},{status:503});
    }
    return NextResponse.json({id:result.data.user.id},{status:201,headers});
  }catch{return NextResponse.json({error:"Admission is unavailable. Contact ALS support."},{status:503});}
}
