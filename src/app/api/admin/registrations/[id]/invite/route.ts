import { NextResponse } from "next/server";
import { adminSession } from "@/lib/admin-session";
import { isSameOriginRequest } from "@/lib/request-origin";
import { validAccountId } from "@/lib/account-validation";
import { sendRegistrationInvitation } from "@/lib/registration-invitation";
export async function POST(request:Request, context:{params:Promise<{id:string}>}) {
  if(!isSameOriginRequest(request))return NextResponse.json({error:"Invalid request."},{status:403});
  const session=await adminSession(); if(session.response)return session.response;
  const {id}=await context.params; if(!validAccountId(id))return NextResponse.json({error:"Invalid application."},{status:400});
  try {
    const result=await session.db!.from("student_registrations").select("status,student_id,email").eq("id",id).maybeSingle();
    if(result.error)return NextResponse.json({error:"Application could not be loaded."},{status:503});
    if(result.data?.status!=="approved" || !result.data.student_id)return NextResponse.json({error:"Only approved applications can be invited."},{status:409});
    const invitation=await sendRegistrationInvitation(id,result.data.student_id,result.data.email);
    return NextResponse.json({success:true,invitation},{headers:{"Cache-Control":"private, no-store"}});
  } catch {return NextResponse.json({error:"Invitation could not be sent."},{status:503});}
}
