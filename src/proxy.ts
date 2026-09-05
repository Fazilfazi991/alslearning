import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { refreshSession } from "@/lib/supabase/proxy";
export function proxy(request:NextRequest){if(!hasSupabaseConfig())return NextResponse.next();return refreshSession(request)}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]};
