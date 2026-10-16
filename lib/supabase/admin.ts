import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getPublicSupabaseEnv } from "./env";
import { ServiceUnavailableError } from "@/lib/errors";

/**
 * Service-role client. Bypasses RLS, so it is used only by server code that
 * has already authenticated the user and validated input (media pipeline,
 * community publishing). Never import this from client components.
 */
export function createSupabaseAdminClient() {
  const env = getPublicSupabaseEnv();
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env || !secret) {
    throw new ServiceUnavailableError("Server storage credentials are not configured (SUPABASE_SECRET_KEY).");
  }
  return createClient<Database>(env.url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
