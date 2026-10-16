import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { getPublicSupabaseEnv } from "./env";
import { ServiceUnavailableError } from "@/lib/errors";

export type AppSupabaseClient = ReturnType<typeof createServerClient<Database>>;

/**
 * Request-scoped Supabase client acting as the signed-in user (RLS applies).
 * Must be created per request.
 */
export async function createSupabaseServerClient(): Promise<AppSupabaseClient> {
  const env = getPublicSupabaseEnv();
  if (!env) throw new ServiceUnavailableError("The online backend is not configured. See README → Environment variables.");
  const cookieStore = await cookies();
  return createServerClient<Database>(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: cookies are refreshed by the proxy instead.
        }
      },
    },
  });
}
