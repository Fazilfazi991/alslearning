import { AdminShell } from "@/components/admin/admin-shell";
import { RegistrationDetail } from "@/components/registration/admin-detail";
import { requireRole } from "@/lib/auth";

export default async function RegistrationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["admin"]);
  const { id } = await params;
  return <AdminShell><RegistrationDetail id={id} /></AdminShell>;
}
