import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

// This client is for Auth administration only, after canonical Admin checks.
// Never import it from a Client Component or use it for ordinary portal reads.
export function createAuthAdminClient() {
  const { url } = supabaseConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Account management is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
