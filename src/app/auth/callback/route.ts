import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const failure = () => NextResponse.redirect(new URL("/login?error=invalid-link", url.origin));
  if (url.searchParams.has("error")) return failure();
  try {
    const db = await createClient();
    if (code) {
      const flowId = url.searchParams.get("sb_flow_id");
      const { error } = await db.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
      if (!error) return NextResponse.redirect(new URL("/student", url.origin));
    } else if (tokenHash && (type === "magiclink" || type === "email")) {
      const { error } = await db.auth.verifyOtp({ token_hash: tokenHash, type });
      if (!error) return NextResponse.redirect(new URL("/student", url.origin));
    }
  } catch {
    // Expired links and missing browser verifiers require a fresh sign-in.
  }
  return failure();
}
