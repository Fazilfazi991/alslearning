import { NextResponse } from "next/server";
import { adminSession } from "@/lib/admin-session";
import { createAuthAdminClient } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/request-origin";
import { validAccountId } from "@/lib/account-validation";
import { sendRegistrationInvitation } from "@/lib/registration-invitation";
const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: Request, context: {params: Promise<{id:string}>}) {
  if (!isSameOriginRequest(request)) return NextResponse.json({error:"Invalid request."},{status:403});
  const session=await adminSession(); if(session.response)return session.response;
  const {id}=await context.params;
  const body:unknown=await request.json().catch(()=>null);
  if(!validAccountId(id) || !body || typeof body!=="object" || Object.keys(body).length!==1 || !validAccountId((body as Record<string,unknown>).batch_id)) return NextResponse.json({error:"Select a compatible batch."},{status:400});
  const batchId=(body as {batch_id:string}).batch_id;
  try {
    const ready=await session.db!.rpc("registration_admission_ready");
    if(ready.error || ready.data!==true)return NextResponse.json({error:"Registration approval is not configured. No account was created."},{status:503,headers});
    const result=await session.db!.from("student_registrations").select("id,full_name,email,phone,qualification,institution,program_id,consent_at,enquiry_id,status,student_id").eq("id",id).maybeSingle();
    if(result.error)return NextResponse.json({error:"Application could not be loaded."},{status:503,headers});
    const application=result.data;
    if(!application)return NextResponse.json({error:"Application not found."},{status:404,headers});
    if(application.status!=="pending" || application.student_id)return NextResponse.json({error:"This application is not awaiting approval."},{status:409,headers});
    const batch=await session.db!.from("batches").select("id,program_id,batch_code,status").eq("id",batchId).maybeSingle();
    if(batch.error || !batch.data || batch.data.program_id!==application.program_id || batch.data.status!=="active" || !batch.data.batch_code)return NextResponse.json({error:"Choose an active compatible batch with a batch code."},{status:422,headers});
    // The database's admission and registration triggers lock and recheck all
    // requirements, capacity and identity as part of this Auth transaction.
    const root=createAuthAdminClient(), now=new Date();
    const created=await root.auth.admin.createUser({email:application.email, email_confirm:false, app_metadata:{role:"student",lms_admission:{registration_id:id,actor_id:session.user!.id,full_name:application.full_name,phone:application.phone,program_id:application.program_id,batch_id:batchId,admission_on:now.toISOString().slice(0,10),access_starts_at:now.toISOString(),access_expires_at:null,unassigned:false,is_active:true,guardian_name:"",guardian_phone:"",guardian_relationship:"",address:"",internal_notes:"",...(application.enquiry_id?{enquiry_id:application.enquiry_id}:{})}},user_metadata:{full_name:application.full_name}});
    if(created.error || !created.data.user)return NextResponse.json({error:"Approval could not be completed. Check the application, batch capacity and existing identities before retrying."},{status:409,headers});
    const studentId=created.data.user.id;
    const verified=await session.db!.from("student_registrations").select("status,student_id,email").eq("id",id).maybeSingle();
    if(verified.error || verified.data?.status!=="approved" || verified.data.student_id!==studentId)return NextResponse.json({error:"The admission outcome could not be verified. Review the application before retrying."},{status:503,headers});
    const invitation=await sendRegistrationInvitation(id,studentId,verified.data.email);
    return NextResponse.json({success:true,invitation},{headers});
  }catch{return NextResponse.json({error:"The admission outcome could not be verified. Review the application before retrying."},{status:503,headers});}
}
