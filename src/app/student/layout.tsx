import{StudentShell}from"@/components/student/student-shell";
import{requireRole}from"@/lib/auth";
export default async function StudentLayout({children}:{children:React.ReactNode}){const user=await requireRole(["student"]);return <StudentShell user={{name:user.full_name||"Student",email:user.email||""}}>{children}</StudentShell>}
