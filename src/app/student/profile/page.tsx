import { UserRound } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/student/page-header";

export default async function ProfilePage() {
  const user = await requireRole(["student"]);
  const db = await createClient();
  const { data: enrollments, error } = await db.from("enrollments")
    .select("id,status,access_expires_at,programs(name)")
    .eq("student_id", user.id).eq("status", "active");
  if (error) throw new Error("Your profile could not be loaded.");
  return <div className="mx-auto max-w-3xl"><PageHeader title="Profile" description="Your ALS account and program access."/><section className="card p-6"><UserRound className="text-brand" aria-hidden="true"/><dl className="mt-5 grid gap-5 sm:grid-cols-2"><div><dt className="text-sm text-muted">Name</dt><dd className="font-bold">{user.full_name || "Name not provided"}</dd></div><div><dt className="text-sm text-muted">Email</dt><dd className="break-all font-bold">{user.email}</dd></div></dl></section><section className="card mt-5 p-6"><h2 className="text-lg font-bold">Program access</h2>{enrollments?.length ? <ul className="mt-4 space-y-3">{enrollments.map(item => <li key={item.id} className="rounded-lg border p-4"><p className="font-semibold">{(item.programs as unknown as {name:string}|null)?.name || "Program"}</p><p className="mt-1 text-sm text-muted">Access expires: {item.access_expires_at ? new Date(item.access_expires_at).toLocaleDateString() : "No expiry set"}</p></li>)}</ul> : <p className="mt-3 text-sm text-muted">No active program access.</p>}</section></div>;
}
