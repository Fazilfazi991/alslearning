import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAuthAdminClient } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/request-origin";
import { isManagedRole, passwordHelp, validAccountEmail, validAccountId, validAccountName, validAccountPassword } from "@/lib/account-validation";

const failure = (error: string, status: number) => NextResponse.json({ error }, { status });
async function adminSession() {
  const db = await createClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) return { response: failure("Sign in to continue.", 401) };
  const profile = await db.from("profiles").select("role,is_active").eq("id", data.user.id).single();
  if (profile.error || !profile.data?.is_active || profile.data.role !== "admin") return { response: failure("Administrator access required.", 403) };
  return { db };
}
async function bodyOf(request: Request) {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch { return null; }
}

export async function GET(request: Request) {
  try {
    const session = await adminSession();
    if (session.response) return session.response;
    const role = new URL(request.url).searchParams.get("role");
    if (!isManagedRole(role)) return failure("Choose a Student or Teacher role.", 400);
    const result = await session.db!.from("profiles").select("id,full_name,email,role,is_active").eq("role", role).order("full_name");
    if (result.error) return failure("Accounts could not be loaded. Please retry.", 503);
    return NextResponse.json({ accounts: result.data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return failure("Accounts could not be loaded. Please retry.", 503); }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return failure("Invalid request.", 403);
  try {
    const session = await adminSession();
    if (session.response) return session.response;
    const body = await bodyOf(request);
    if (!body || !isManagedRole(body.role) || !validAccountName(body.full_name) || !validAccountEmail(body.email)) return failure("Enter a valid name, email and account role.", 400);
    if (!validAccountPassword(body.password)) return failure(passwordHelp, 400);
    const root = createAuthAdminClient();
    const email = body.email.trim().toLowerCase(), name = body.full_name.trim();
    const created = await root.auth.admin.createUser({ email, password: body.password, email_confirm: true, app_metadata: { role: body.role }, user_metadata: { full_name: name } });
    if (created.error || !created.data.user) {
      const duplicate = ["email_exists", "user_already_exists"].includes(created.error?.code || "") || /already.*registered|already.*exists/i.test(created.error?.message || "");
      return failure(duplicate ? "An account already uses this email. Edit that account instead." : "The login account could not be created. Please retry.", duplicate ? 409 : 503);
    }
    // Only the Auth trigger creates the canonical profile. Never insert a second profile.
    const profile = await session.db!.from("profiles").select("id,role,email,full_name,is_active").eq("id", created.data.user.id).single();
    if (profile.error || profile.data?.role !== body.role || !profile.data.is_active || profile.data.email?.toLowerCase() !== email) {
      await root.auth.admin.deleteUser(created.data.user.id);
      return failure("The account profile could not be created. Please retry.", 503);
    }
    return NextResponse.json({ account: profile.data }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch { return failure("Account management is unavailable. Please contact ALS support.", 503); }
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return failure("Invalid request.", 403);
  try {
    const session = await adminSession();
    if (session.response) return session.response;
    const body = await bodyOf(request);
    if (!body || !validAccountId(body.id)) return failure("Choose a valid account.", 400);
    const current = await session.db!.from("profiles").select("id,role,full_name,email,is_active").eq("id", body.id).single();
    if (current.error || !current.data) return failure("Account not found.", 404);
    if (!isManagedRole(current.data.role)) return failure("Only Student and Teacher accounts can be managed here.", 403);
    if (Object.keys(body).some(key => !["id", "full_name", "is_active", "password"].includes(key))) return failure("Email and role cannot be changed here.", 400);
    if (body.full_name !== undefined && !validAccountName(body.full_name)) return failure("Enter a name of 1–120 characters.", 400);
    if (body.is_active !== undefined && typeof body.is_active !== "boolean") return failure("Choose a valid account status.", 400);
    if (body.password !== undefined && !validAccountPassword(body.password)) return failure(passwordHelp, 400);
    if (Object.keys(body).length === 1) return failure("No changes supplied.", 400);
    const root = createAuthAdminClient();
    if (body.password !== undefined) {
      const changed = await root.auth.admin.updateUserById(body.id, { password: body.password as string });
      if (changed.error) return failure("The password could not be reset. Please retry.", 503);
    }
    const values: { full_name?: string; is_active?: boolean } = {};
    if (typeof body.full_name === "string") values.full_name = body.full_name.trim();
    if (typeof body.is_active === "boolean") values.is_active = body.is_active;
    if (Object.keys(values).length) {
      const updated = await session.db!.from("profiles").update(values).eq("id", body.id).select("id,role,full_name,email,is_active").single();
      if (updated.error || !updated.data) return failure("Account details could not be saved. Please retry.", 503);
    }
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return failure("Account changes could not be saved. Please retry.", 503); }
}
