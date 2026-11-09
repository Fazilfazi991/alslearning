import { AdminShell } from "@/components/admin/admin-shell";
import { EnquiriesManager } from "@/components/admin/enquiries-manager";
import { requireRole } from "@/lib/auth";
import { enquiryStatuses } from "@/components/admin/enquiries-shared";

export default async function EnquiriesPage({searchParams}:{searchParams:Promise<{status?:string;pending?:string}>}) {
  await requireRole(["admin"]);
  const {status="",pending}=await searchParams;
  return <AdminShell><EnquiriesManager initialStatus={enquiryStatuses.some(value=>value===status)?status:""} initialPending={pending==="true"} /></AdminShell>;
}
