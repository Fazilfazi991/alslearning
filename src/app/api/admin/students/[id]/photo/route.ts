import {NextResponse} from "next/server";
import {adminSession} from "@/lib/admin-session";
import {isSameOriginRequest} from "@/lib/request-origin";
import {validAccountId} from "@/lib/account-validation";
import {photoExtension,profilePhotoLimit} from "@/lib/student-profile";
export async function POST(request:Request,context:RouteContext<"/api/admin/students/[id]/photo">){
  if(!isSameOriginRequest(request))return NextResponse.json({error:"Invalid request."},{status:403});
  const s=await adminSession();if(s.response)return s.response;
  const {id}=await context.params;if(!validAccountId(id))return NextResponse.json({error:"Invalid Student."},{status:400});
  const person=await s.db!.from("profiles").select("id").eq("id",id).eq("role","student").single();
  if(!person.data)return NextResponse.json({error:"Student not found."},{status:404});
  let file:FormDataEntryValue|null;try{file=(await request.formData()).get("photo");}catch{return NextResponse.json({error:"Choose a profile photo."},{status:400});}
  if(!(file instanceof File)||file.size<=0||file.size>profilePhotoLimit)return NextResponse.json({error:"Choose a JPEG, PNG or WebP up to 2 MB."},{status:400});
  const bytes=new Uint8Array(await file.arrayBuffer()),extension=photoExtension(file.type,bytes);
  if(!extension)return NextResponse.json({error:"The photo content does not match its file type."},{status:400});
  const path=`${id}/${crypto.randomUUID()}.${extension}`;
  const uploaded=await s.db!.storage.from("profile-photos").upload(path,bytes,{contentType:file.type,upsert:false});
  if(uploaded.error)return NextResponse.json({error:"Photo upload failed. Retry without recreating the Student."},{status:503});
  const result=await s.db!.from("profiles").update({avatar_path:path,updated_at:new Date().toISOString()}).eq("id",id).select("id").single();
  if(result.error){await s.db!.storage.from("profile-photos").remove([path]);return NextResponse.json({error:"Photo was not attached. Retry without recreating the Student."},{status:503});}
  return NextResponse.json({success:true});
}
