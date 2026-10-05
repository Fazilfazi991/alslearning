import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { isSameOriginRequest } from "@/lib/request-origin";
import { validAccountName } from "@/lib/account-validation";
import { photoExtension, profilePhotoLimit, profilePhotoTypes, validProfilePhone } from "@/lib/student-profile";

export const runtime = "nodejs";
const failure = (error: string, status: number) => NextResponse.json({error},{status});
export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return failure("Invalid request.",403);
  try {
    const db = await createClient();
    const auth = await db.auth.getUser();
    if (auth.error || !auth.data.user) return failure("Sign in to continue.",401);
    const id = auth.data.user.id;
    const current = await db.from("profiles").select("role,is_active").eq("id",id).single();
    if (current.error || current.data?.role !== "student" || !current.data.is_active) return failure("Active Student access required.",403);
    if (Number(request.headers.get("content-length") || 0) > profilePhotoLimit + 32768) return failure("Choose a photo smaller than 2 MB.",413);
    let body: FormData;
    try { body = await request.formData(); } catch { return failure("Invalid profile form.",400); }
    if ([...body.keys()].some(key => !["full_name","phone","photo"].includes(key)) || ["full_name","phone","photo"].some(key => body.getAll(key).length>1)) return failure("Only name, phone and profile photo can be changed here.",400);
    const name = body.get("full_name"), phone = body.get("phone") ?? "", photo = body.get("photo");
    if (!validAccountName(name) || !validProfilePhone(phone)) return failure("Enter a valid name and phone number.",400);
    let path: string | null = null;
    const bucket = db.storage.from("profile-photos");
    if (photo !== null) {
      if (!(photo instanceof File) || !photo.size || photo.size>profilePhotoLimit || !profilePhotoTypes.includes(photo.type)) return failure("Choose a JPEG, PNG or WebP photo smaller than 2 MB.",400);
      const bytes = new Uint8Array(await photo.arrayBuffer()), extension = photoExtension(photo.type,bytes);
      if (!extension) return failure("This file is not a supported photo.",400);
      path = `${id}/${randomUUID()}.${extension}`;
      const uploaded = await bucket.upload(path,bytes,{contentType:photo.type,upsert:false});
      if (uploaded.error) return failure("Your photo could not be uploaded. Please retry.",503);
    }
    const saved = await db.rpc("save_student_profile",{target_name:name.trim(),target_phone:phone.trim(),target_avatar:path});
    if (saved.error || saved.data?.id !== id) {
      if (path) await bucket.remove([path]);
      return failure("Your profile could not be saved. Please retry.",503);
    }
    const previous = saved.data.previous_avatar_path as string | null;
    if (path && previous && previous !== path && previous.startsWith(`${id}/`)) await bucket.remove([previous]);
    const avatar = saved.data.avatar_path as string | null;
    const signed = avatar ? await bucket.createSignedUrl(avatar,3600) : null;
    return NextResponse.json({profile:{full_name:saved.data.full_name,phone:saved.data.phone,photo_url:signed?.data?.signedUrl ?? null}},{headers:{"Cache-Control":"private, no-store"}});
  } catch { return failure("Your profile could not be saved. Please retry.",503); }
}
