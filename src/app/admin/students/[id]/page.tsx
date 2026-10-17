import { AdminShell } from "@/components/admin/admin-shell";
import { StudentDetails } from "@/components/admin/student-details";
import { requireRole } from "@/lib/auth";
export default async function Page({params}:{params:Promise<{id:string}>}) {
  await requireRole(["admin"]);const {id}=await params;
  return <AdminShell><StudentDetails key={id} id={id}/></AdminShell>;
}
