import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseConfig } from "./config";

// Auth can set cookies during OTP verification. Keep them private until all
// application authorization checks pass, including any later refresh writes.
export async function createBufferedAuthClient() {
  const store = await cookies();
  const pending = new Map<string, { name: string; value: string; options: CookieOptions }>();
  const { url, key } = supabaseConfig();
  const db = createServerClient(url, key, { cookies: {
    getAll() {
      const values = new Map(store.getAll().map(cookie => [cookie.name, { name: cookie.name, value: cookie.value }]));
      for (const cookie of pending.values()) values.set(cookie.name, { name: cookie.name, value: cookie.value });
      return [...values.values()];
    },
    setAll(values) { for (const value of values) pending.set(value.name, value); },
  } });
  return { db, publish(response: NextResponse) { for (const cookie of pending.values()) response.cookies.set(cookie.name, cookie.value, cookie.options); } };
}
