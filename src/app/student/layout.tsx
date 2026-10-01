import{StudentShell}from"@/components/student/student-shell";
import { createClient } from "@/lib/supabase/server";
import{requireRole}from"@/lib/auth";
export default async function StudentLayout({children}:{children:React.ReactNode}){const user=await requireRole(["student"]);const db=await createClient();const {count,error}=await db.from("notifications").select("id",{head:true,count:"exact"}).eq("recipient_id",user.id).is("read_at",null);return <StudentShell user={{name:user.full_name||"Student",email:user.email||""}} unreadCount={error?0:count||0}>{children}</StudentShell>}
