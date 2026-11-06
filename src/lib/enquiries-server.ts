import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./supabase/config";
import type { EnquiryProgram } from "@/types/enquiries";

// Public admission writes use only the narrowly scoped service-only RPC below.
// This module must never enter a client component's import graph.
export function enquiryService() {
  const { url } = supabaseConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Enquiries are not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function getPublicEnquiryPrograms(): Promise<EnquiryProgram[]> {
  const result = await enquiryService().from("programs").select("id,name,description").eq("status", "active").order("display_order").order("name");
  if (result.error) throw new Error("Course information is currently unavailable.");
  return result.data;
}
