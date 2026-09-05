import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppRole="student"|"teacher"|"admin";
export async function currentUser(){const supabase=await createClient();const{data}=await supabase.auth.getClaims();if(!data?.claims?.sub)return null;const{data:profile,error}=await supabase.from("profiles").select("id,role,full_name,email,is_active").eq("id",data.claims.sub).single();if(error||!profile?.is_active)return null;return{...profile,id:String(profile.id),role:profile.role as AppRole}}
export async function requireRole(allowed:AppRole[]){const user=await currentUser();if(!user)redirect("/login");if(!allowed.includes(user.role))redirect(`/${user.role}`);return user}
