import { AdminShell } from "@/components/admin/admin-shell";
import { EnquiryDetail } from "@/components/admin/enquiries-detail";
import { requireRole } from "@/lib/auth";

export default async function EnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["admin"]);
  const { id } = await params;
  return <AdminShell><EnquiryDetail id={id} /></AdminShell>;
}
