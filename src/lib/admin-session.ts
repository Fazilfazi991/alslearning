import "server-only";
import { createClient } from "./supabase/server";
import { NextResponse } from "next/server";
export async function adminSession() {
  const db=await createClient(); const {data,error}=await db.auth.getUser();
  if(error || !data.user) return {response:NextResponse.json({error:"Sign in to continue."},{status:401})};
  const profile=await db.from("profiles").select("role,is_active").eq("id",data.user.id).single();
  if(profile.error || !profile.data?.is_active || profile.data.role!=="admin") return {response:NextResponse.json({error:"Administrator access required."},{status:403})};
  return {db,user:data.user};
}
