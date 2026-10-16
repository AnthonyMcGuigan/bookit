/**
 * Environment configuration. Public values may reach the browser; the secret
 * key is only ever read on the server (see lib/supabase/admin.ts).
 */
export interface PublicSupabaseEnv {
  url: string;
  publishableKey: string;
}

export function getPublicSupabaseEnv(): PublicSupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export function isSupabaseConfigured(): boolean {
  return getPublicSupabaseEnv() !== null;
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** Development-only entitlement testing (also requires app_config flag in the database). */
export function devEntitlementsAllowed(): boolean {
  return process.env.ENABLE_DEV_ENTITLEMENTS === "true" && process.env.NODE_ENV !== "production"
    ? true
    : process.env.ENABLE_DEV_ENTITLEMENTS === "true" && process.env.ALLOW_DEV_ENTITLEMENTS_IN_PRODUCTION === "true";
}
