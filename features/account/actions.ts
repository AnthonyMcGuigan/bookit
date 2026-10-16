"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/forms";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { devEntitlementsAllowed, siteUrl } from "@/lib/supabase/env";
import { errorMessage } from "@/lib/errors";

const profileForm = z.object({
  display_name: z.string().trim().min(1, "Display name is required").max(40),
  handle: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/, "3–24 lowercase letters, numbers or underscores"),
  bio: z.string().max(500).default(""),
  website_url: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^https:\/\/[^\s]{3,200}$/.test(v), "Use a full https:// link"),
});

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = profileForm.safeParse({
    display_name: formData.get("display_name"),
    handle: formData.get("handle"),
    bio: formData.get("bio") ?? "",
    website_url: formData.get("website_url") || undefined,
  });
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id);
  if (error) {
    if (/duplicate key/.test(error.message)) return { error: "That handle is taken.", fieldErrors: { handle: ["Taken"] } };
    return { error: errorMessage(error) };
  }
  revalidatePath("/account");
  return { ok: true, message: "Profile saved." };
}

export async function changeEmailAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const email = z.email("Enter a valid email").safeParse(String(formData.get("email") ?? "").trim());
  if (!email.success) return { error: "Enter a valid email.", fieldErrors: { email: ["Invalid"] } };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ email: email.data }, { emailRedirectTo: `${siteUrl()}/auth/confirm?next=/account` });
  if (error) return { error: errorMessage(error) };
  return { ok: true, message: "Check both inboxes: confirm the change from the link we sent." };
}

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const current = String(formData.get("current_password") ?? "");
  const next = String(formData.get("new_password") ?? "");
  if (next.length < 8) return { error: "Use at least 8 characters.", fieldErrors: { new_password: ["Too short"] } };
  if (next !== String(formData.get("confirm_password") ?? "")) return { error: "The new passwords don't match.", fieldErrors: { confirm_password: ["Doesn't match"] } };
  const supabase = await createSupabaseServerClient();
  // Re-authenticate before changing the password.
  const check = await supabase.auth.signInWithPassword({ email: user.email, password: current });
  if (check.error) return { error: "Your current password is incorrect.", fieldErrors: { current_password: ["Incorrect"] } };
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { error: errorMessage(error) };
  return { ok: true, message: "Password changed." };
}

const devState = z.enum(["none", "active", "expired", "cancelled_active"]);

/** Development-only: simulate entitlement states without any payment provider. */
export async function devSetEntitlementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  if (!devEntitlementsAllowed()) return { error: "Development entitlements are disabled on this server." };
  const state = devState.safeParse(formData.get("state"));
  if (!state.success) return { error: "Unknown state." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("dev_set_entitlement_state", { p_state: state.data });
  if (error) return { error: errorMessage(error) };
  revalidatePath("/account");
  return { ok: true, message: `Test state applied. Effective plan: ${data}.` };
}
