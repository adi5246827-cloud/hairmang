import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

/**
 * Service-role client for server-side Edge Functions.
 * Bypasses RLS — use only inside trusted function code, never expose the key.
 */
export function adminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}
