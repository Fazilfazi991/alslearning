import { requireRole } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { ChangePassword } from "@/components/shared/change-password";

export default async function Profile() {
  const user = await requireRole(["admin"]);
  return <AdminShell><div className="mx-auto max-w-3xl"><h1 className="text-3xl font-bold">Administrator profile</h1><section className="card mt-6 p-6"><dl className="grid gap-4 sm:grid-cols-2"><div><dt className="text-sm text-muted">Name</dt><dd className="font-bold">{user.full_name || "Name not provided"}</dd></div><div><dt className="text-sm text-muted">Email</dt><dd className="break-all font-bold">{user.email}</dd></div><div><dt className="text-sm text-muted">Role</dt><dd className="font-bold">Administrator</dd></div></dl></section><ChangePassword /></div></AdminShell>;
}
