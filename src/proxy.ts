import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { refreshSession } from "@/lib/supabase/proxy";
import { applyStagingHeaders, stagingAccessResponse } from "@/lib/staging-access";

export async function proxy(request: NextRequest) {
  const gate = await stagingAccessResponse(request);
  if (gate) return gate;
  if (!hasSupabaseConfig()) return applyStagingHeaders(NextResponse.next());
  const response=applyStagingHeaders(await refreshSession(request));
  if(/^\/(admin|teacher|student)(\/|$)/.test(request.nextUrl.pathname)) {
    response.headers.set("Cache-Control","private, no-store, max-age=0");
  }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] };
