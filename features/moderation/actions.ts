"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/forms";
import { requireUser, isModerator, getRoles } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { failure, formFields, invalid } from "@/features/game/context";

const reason = z.string().trim().min(3, "Give a reason (at least 3 characters)").max(2000);

async function moderatorClient() {
  const user = await requireUser("/moderation");
  // The database re-checks the role inside every moderation function.
  if (!(await isModerator(user.id))) throw new Error("FORBIDDEN");
  return { user, supabase: await createSupabaseServerClient() };
}

function done(message: string): ActionState {
  revalidatePath("/moderation", "layout");
  revalidatePath("/community", "layout");
  return { ok: true, message };
}

export async function moderateCreationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({ creationId: z.uuid(), action: z.enum(["approve", "reject", "hide", "remove", "restore"]), reason, reportId: z.uuid().optional() })
    .safeParse(formFields(formData));
  if (!parsed.success) return invalid(parsed.error);
  try {
    const { supabase } = await moderatorClient();
    const { error } = await supabase.rpc("moderate_creation", {
      p_creation: parsed.data.creationId,
      p_action: parsed.data.action,
      p_reason: parsed.data.reason,
      p_report: (parsed.data.reportId ?? null) as string,
    });
    if (error) throw error;
    return done("Decision recorded.");
  } catch (e) {
    return failure(e);
  }
}

export async function resolveReportAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ reportId: z.uuid(), resolution: z.enum(["actioned", "dismissed"]), note: reason }).safeParse(formFields(formData));
  if (!parsed.success) return invalid(parsed.error);
  try {
    const { supabase } = await moderatorClient();
    const { error } = await supabase.rpc("resolve_report", { p_report: parsed.data.reportId, p_resolution: parsed.data.resolution, p_note: parsed.data.note });
    if (error) throw error;
    return done("Report resolved.");
  } catch (e) {
    return failure(e);
  }
}

export async function decideAppealAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ appealId: z.uuid(), decision: z.enum(["uphold", "deny"]), note: reason }).safeParse(formFields(formData));
  if (!parsed.success) return invalid(parsed.error);
  try {
    const { supabase } = await moderatorClient();
    const { error } = await supabase.rpc("decide_appeal", { p_appeal: parsed.data.appealId, p_uphold: parsed.data.decision === "uphold", p_note: parsed.data.note });
    if (error) throw error;
    return done(parsed.data.decision === "uphold" ? "Appeal upheld; the creation is restored." : "Appeal denied.");
  } catch (e) {
    return failure(e);
  }
}

export async function resolveTakedownAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({ requestId: z.uuid(), status: z.enum(["content_removed", "rejected", "counter_notice"]), note: reason })
    .safeParse(formFields(formData));
  if (!parsed.success) return invalid(parsed.error);
  try {
    const { supabase } = await moderatorClient();
    const { error } = await supabase.rpc("resolve_takedown", { p_request: parsed.data.requestId, p_status: parsed.data.status, p_note: parsed.data.note });
    if (error) throw error;
    return done("Takedown request updated.");
  } catch (e) {
    return failure(e);
  }
}

async function userIdForHandle(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, handle: string): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("id").eq("handle", handle.replace(/^@/, "").toLowerCase()).maybeSingle();
  return data?.id ?? null;
}

export async function restrictAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({
      handle: z.string().trim().min(3).max(25),
      kind: z.enum(["suspended", "publishing_disabled"]),
      reason,
      days: z.coerce.number().int().min(1).max(3650).optional(),
    })
    .safeParse(formFields(formData));
  if (!parsed.success) return invalid(parsed.error);
  try {
    const { supabase } = await moderatorClient();
    const userId = await userIdForHandle(supabase, parsed.data.handle);
    if (!userId) return { error: "No creator with that handle." };
    const { error } = await supabase.rpc("restrict_account", { p_user: userId, p_kind: parsed.data.kind, p_reason: parsed.data.reason, p_days: (parsed.data.days ?? null) as number });
    if (error) throw error;
    return done("Restriction applied.");
  } catch (e) {
    return failure(e);
  }
}

export async function liftRestrictionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ restrictionId: z.uuid(), reason }).safeParse(formFields(formData));
  if (!parsed.success) return invalid(parsed.error);
  try {
    const { supabase } = await moderatorClient();
    const { error } = await supabase.rpc("lift_restriction", { p_restriction: parsed.data.restrictionId, p_reason: parsed.data.reason });
    if (error) throw error;
    return done("Restriction lifted.");
  } catch (e) {
    return failure(e);
  }
}

export async function setRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({ handle: z.string().trim().min(3).max(25), role: z.enum(["moderator", "admin"]), grant: z.enum(["grant", "revoke"]), reason })
    .safeParse(formFields(formData));
  if (!parsed.success) return invalid(parsed.error);
  try {
    const { user, supabase } = await moderatorClient();
    if (!(await getRoles(user.id)).includes("admin")) return { error: "Only admins can change roles." };
    const userId = await userIdForHandle(supabase, parsed.data.handle);
    if (!userId) return { error: "No creator with that handle." };
    const { error } = await supabase.rpc("set_user_role", { p_user: userId, p_role: parsed.data.role, p_grant: parsed.data.grant === "grant", p_reason: parsed.data.reason });
    if (error) throw error;
    return done(parsed.data.grant === "grant" ? "Role granted." : "Role revoked.");
  } catch (e) {
    return failure(e);
  }
}

export async function submitAppealAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser("/account/moderation");
  const parsed = z
    .object({ creationId: z.uuid(), message: z.string().trim().min(10, "Explain in at least 10 characters").max(2000) })
    .safeParse(formFields(formData));
  if (!parsed.success) return invalid(parsed.error);
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("submit_appeal", { p_creation: parsed.data.creationId, p_message: parsed.data.message });
    if (error) throw error;
    revalidatePath("/account/moderation");
    return { ok: true, message: "Appeal submitted. A moderator will review it." };
  } catch (e) {
    return failure(e);
  }
}

const takedownSchema = z.object({
  claimantName: z.string().trim().min(2).max(120),
  claimantEmail: z.email().max(200),
  claimantOrganization: z.string().trim().max(120).default(""),
  relationship: z.enum(["owner", "authorized_agent"]),
  workDescription: z.string().trim().min(10, "Describe the work in at least 10 characters").max(4000),
  infringingUrl: z.string().trim().min(5).max(500),
  signature: z.string().trim().min(2).max(120),
  website: z.string().max(0).optional(), // honeypot: real people leave it empty
});

export async function submitTakedownAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = takedownSchema.safeParse(formFields(formData));
  if (!parsed.success) return invalid(parsed.error);
  const t = parsed.data;
  if (formData.get("goodFaith") !== "on" || formData.get("accuracy") !== "on") {
    return { error: "Both statements are required for a valid request.", fieldErrors: { statements: ["Required"] } };
  }
  // Link the request to a creation when the URL points at one.
  const match = t.infringingUrl.match(/\/community\/([0-9a-f-]{36})/i);
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("submit_takedown", {
      p_claimant_name: t.claimantName,
      p_claimant_email: t.claimantEmail,
      p_claimant_organization: t.claimantOrganization,
      p_relationship: t.relationship,
      p_work_description: t.workDescription,
      p_creation: (match?.[1] ?? null) as string,
      p_infringing_url: t.infringingUrl,
      p_good_faith: true,
      p_accuracy: true,
      p_signature: t.signature,
    });
    if (error) throw error;
    return { ok: true, message: "Request received. Any linked creation is hidden while moderators review the request; they will contact you at the email address you gave." };
  } catch (e) {
    return failure(e);
  }
}
