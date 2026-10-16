"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/forms";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { publishFromUniverse, normaliseTags } from "@/lib/community/service";
import { deleteUserImage } from "@/lib/media/service";
import { PACKAGE_KINDS } from "@/lib/packages/schema";
import { checked, failure, formFields, invalid } from "@/features/game/context";
import { REPORT_CATEGORIES } from "./constants";

const metadataSchema = z.object({
  title: z.string().trim().min(3, "At least 3 characters").max(80),
  summary: z.string().trim().max(200).default(""),
  description: z.string().trim().max(5000).default(""),
  tags: z.string().max(400).default(""),
  visibility: z.enum(["draft", "published", "unlisted"]),
});

const publishSchema = metadataSchema.extend({
  universeId: z.uuid(),
  kind: z.enum(PACKAGE_KINDS),
  rootId: z.uuid().optional(),
  creationId: z.uuid().optional(),
  changelog: z.string().trim().max(1000).default(""),
});

export async function publishCreationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const fields = formFields(formData);
  // The root select for the chosen kind is named root_<kind>.
  const parsed = publishSchema.safeParse({ ...fields, rootId: fields[`root_${fields.kind}`] });
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;
  if (input.kind !== "universe" && input.kind !== "scenario" && !input.rootId) return { error: "Choose what to publish." };
  if (!checked(formData, "rights")) {
    return { error: "Confirm that you have the right to share this content and that it follows the content policy.", fieldErrors: { rights: ["Required"] } };
  }
  let target: string;
  try {
    const supabase = await createSupabaseServerClient();
    const thumbnail = formData.get("thumbnail");
    const result = await publishFromUniverse(supabase, user.id, {
      universeId: input.universeId,
      kind: input.kind,
      rootId: input.rootId ?? null,
      creationId: input.creationId ?? null,
      title: input.title,
      summary: input.summary,
      description: input.description,
      tags: normaliseTags(input.tags),
      visibility: input.visibility,
      isFanContent: checked(formData, "isFanContent"),
      allowDerivatives: checked(formData, "allowDerivatives"),
      changelog: input.changelog,
      includeImages: checked(formData, "includeImages"),
      thumbnail: thumbnail instanceof File && thumbnail.size > 0 ? thumbnail : null,
    });
    const params = new URLSearchParams({ published: String(result.version) });
    if (result.reviewReason) params.set("review", "1");
    if (result.warnings.length) params.set("warnings", result.warnings.join(" ").slice(0, 400));
    target = `/community/${result.creationId}?${params}`;
    revalidatePath("/community", "layout");
  } catch (e) {
    return failure(e);
  }
  redirect(target);
}

const idSchema = z.uuid();

export async function rateCreationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  try {
    const creationId = idSchema.parse(formData.get("creationId"));
    const supabase = await createSupabaseServerClient();
    if (formData.get("remove") === "1") {
      const { error } = await supabase.rpc("remove_creation_rating", { p_creation: creationId });
      if (error) throw error;
      revalidatePath(`/community/${creationId}`);
      return { ok: true, message: "Rating removed." };
    }
    const stars = z.coerce.number().int().min(1).max(5).parse(formData.get("stars"));
    const { error } = await supabase.rpc("rate_creation", { p_creation: creationId, p_stars: stars });
    if (error) throw error;
    revalidatePath(`/community/${creationId}`);
    return { ok: true, message: `Rated ${stars} star${stars === 1 ? "" : "s"}.` };
  } catch (e) {
    if (e instanceof z.ZodError) return { error: "Choose a rating from 1 to 5 stars." };
    return failure(e);
  }
}

const reportSchema = z.object({
  targetType: z.enum(["creation", "user"]),
  creationId: z.uuid().optional(),
  userId: z.uuid().optional(),
  category: z.enum(REPORT_CATEGORIES.map((c) => c.value) as [string, ...string[]]),
  details: z.string().trim().max(2000).default(""),
});

export async function reportAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = reportSchema.safeParse(formFields(formData));
  if (!parsed.success) return invalid(parsed.error, "Choose a reason for the report.");
  const r = parsed.data;
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("file_report", {
      p_target_type: r.targetType,
      p_creation: (r.creationId ?? null) as string,
      p_user: (r.userId ?? null) as string,
      p_category: r.category,
      p_details: r.details,
    });
    if (error) throw error;
    return { ok: true, message: "Thanks. Moderators will review your report." };
  } catch (e) {
    return failure(e);
  }
}

export async function updateCreationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = metadataSchema.extend({ creationId: z.uuid() }).safeParse(formFields(formData));
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;
  try {
    const supabase = await createSupabaseServerClient();
    // Column grants limit owners to these fields; moderation state is untouchable.
    const { data, error } = await supabase
      .from("community_creations")
      .update({
        title: input.title,
        summary: input.summary,
        description: input.description,
        tags: normaliseTags(input.tags),
        visibility: input.visibility,
        allow_derivatives: checked(formData, "allowDerivatives"),
        is_fan_content: checked(formData, "isFanContent"),
      })
      .eq("id", input.creationId)
      .select("id");
    if (error) throw error;
    if (!data?.length) return { error: "Creation not found." };
    revalidatePath("/community", "layout");
    return { ok: true, message: "Creation updated." };
  } catch (e) {
    return failure(e);
  }
}

export async function deleteCreationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  try {
    const creationId = idSchema.parse(formData.get("creationId"));
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("delete_creation", { p_creation: creationId });
    if (error) throw error;
    await Promise.all((data ?? []).map((id) => deleteUserImage(user.id, id).catch(() => undefined)));
    revalidatePath("/community", "layout");
  } catch (e) {
    return failure(e);
  }
  redirect("/community/mine?deleted=1");
}
