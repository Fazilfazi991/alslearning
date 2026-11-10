import { AdminShell } from "@/components/admin/admin-shell";
import { RegistrationManager } from "@/components/registration/admin-manager";
import { requireRole } from "@/lib/auth";

export default async function RegistrationsPage() {
  await requireRole(["admin"]);
  return <AdminShell><RegistrationManager /></AdminShell>;
}
