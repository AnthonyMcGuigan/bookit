import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export interface SessionUser {
  id: string;
  email: string;
  emailConfirmed: boolean;
}

export interface Profile {
  id: string;
  handle: string;
  display_name: string;
  bio: string;
  website_url: string | null;
}

/**
 * Returns the authenticated user, verified by the auth server (not just the
 * cookie). Cached for the duration of a request.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return {
    id: data.user.id,
    email: data.user.email ?? "",
    emailConfirmed: Boolean(data.user.email_confirmed_at),
  };
});

export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in");
  return user;
}

export const getProfile = cache(async (userId: string): Promise<Profile | null> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("profiles").select("id, handle, display_name, bio, website_url").eq("id", userId).maybeSingle();
  return data;
});

export const getRoles = cache(async (userId: string): Promise<string[]> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role);
});

export async function isModerator(userId: string): Promise<boolean> {
  const roles = await getRoles(userId);
  return roles.includes("moderator") || roles.includes("admin");
}

/** Only allow same-site relative redirect targets. */
export function safeNext(next: unknown, fallback = "/universes"): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
