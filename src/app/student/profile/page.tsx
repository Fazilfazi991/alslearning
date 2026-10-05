import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/student/page-header";
import { ChangePassword } from "@/components/shared/change-password";
import { ProfileEditor } from "@/components/student/profile-editor";

export default async function ProfilePage() {
  const user = await requireRole(["student"]);
  const db = await createClient();
  const { data: enrollments, error } = await db.from("enrollments")
    .select("id,status,access_expires_at,programs(name)")
    .eq("student_id", user.id).eq("status", "active");
  if (error) throw new Error("Your profile could not be loaded.");
  const personal = await db.from("profiles").select("full_name,phone,avatar_path").eq("id",user.id).single();
  if (personal.error || !personal.data) throw new Error("Your profile could not be loaded.");
  const photo = personal.data.avatar_path ? await db.storage.from("profile-photos").createSignedUrl(personal.data.avatar_path,3600) : null;
  return <div className="mx-auto max-w-3xl"><PageHeader title="Profile" description="Your ALS account and program access."/><ProfileEditor initial={{full_name:personal.data.full_name || "",phone:personal.data.phone,photo_url:photo?.data?.signedUrl ?? null}} email={user.email}/><section className="card mt-5 p-6"><h2 className="text-lg font-bold">Program access</h2>{enrollments?.length ? <ul className="mt-4 space-y-3">{enrollments.map(item => <li key={item.id} className="rounded-lg border p-4"><p className="font-semibold">{(item.programs as unknown as {name:string}|null)?.name || "Program"}</p><p className="mt-1 text-sm text-muted">Access expires: {item.access_expires_at ? new Date(item.access_expires_at).toLocaleDateString() : "No expiry set"}</p></li>)}</ul> : <p className="mt-3 text-sm text-muted">No active program access.</p>}</section><ChangePassword /></div>;
}
