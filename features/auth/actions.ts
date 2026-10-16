"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/forms";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/supabase/env";
import { errorMessage } from "@/lib/errors";
import { getSessionUser, safeNext } from "@/lib/auth/session";

const email = z.email("Enter a valid email address").max(254);
const password = z.string().min(8, "Use at least 8 characters").max(72, "Use at most 72 characters");

const signUpSchema = z.object({
  email,
  password,
  displayName: z.string().trim().min(1, "Choose a display name").max(40),
  acceptPolicies: z.literal("on", { error: "You must accept the content policy and creator guidelines" }),
});

function fieldErrors(error: z.ZodError): ActionState {
  return { error: "Please fix the highlighted fields.", fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]> };
}

export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
    acceptPolicies: formData.get("acceptPolicies"),
  });
  if (!parsed.success) return fieldErrors(parsed.error);
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${siteUrl()}/auth/confirm?next=/universes`,
        data: { display_name: parsed.data.displayName },
      },
    });
    if (error) {
      if (/registered|already/i.test(error.message)) return { error: "An account with that email already exists. Try signing in." };
      if (/password/i.test(error.message)) return { error: error.message };
      return { error: errorMessage(error) };
    }
    if (data.session) redirect("/universes");
    return { ok: true, message: `Check ${parsed.data.email} for a confirmation link to activate your account.` };
  } catch (e) {
    if (isRedirect(e)) throw e;
    return { error: errorMessage(e) };
  }
}

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ email, password: z.string().min(1, "Enter your password") }).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return fieldErrors(parsed.error);
  const next = safeNext(formData.get("next"));
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) {
      if (/not confirmed/i.test(error.message)) {
        return { error: "Please confirm your email address first. Check your inbox, or resend the confirmation email below.", data: { unconfirmed: true } };
      }
      if (/invalid/i.test(error.message)) return { error: "Incorrect email or password." };
      return { error: errorMessage(error) };
    }
  } catch (e) {
    return { error: errorMessage(e) };
  }
  redirect(next);
}

export async function resendConfirmationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = email.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address." };
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.resend({ type: "signup", email: parsed.data, options: { emailRedirectTo: `${siteUrl()}/auth/confirm?next=/universes` } });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  return { ok: true, message: "If that account is awaiting confirmation, a new link is on its way." };
}

export async function requestPasswordResetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = email.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address.", fieldErrors: { email: ["Enter a valid email address"] } };
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo: `${siteUrl()}/auth/confirm?next=/account/reset-password` });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  // Same response whether or not the account exists (no account enumeration).
  return { ok: true, message: "If an account exists for that email, a reset link has been sent." };
}

export async function updatePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({ password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "Passwords do not match", path: ["confirm"] })
    .safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return fieldErrors(parsed.error);
  const user = await getSessionUser();
  if (!user) return { error: "Your reset link has expired. Request a new one." };
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) return { error: /different from the old/i.test(error.message) ? "Choose a password different from your current one." : errorMessage(error) };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  return { ok: true, message: "Your password has been updated." };
}

export async function signOutAction(): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch {
    // Even if the backend is unreachable, clear the local session cookies.
  }
  redirect("/");
}

function isRedirect(e: unknown): boolean {
  return typeof e === "object" && e !== null && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT");
}
