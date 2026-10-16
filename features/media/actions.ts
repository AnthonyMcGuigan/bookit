"use server";

import { z } from "zod";
import type { ActionState } from "@/components/forms";
import type { MediaKind } from "@/lib/domain/enums";
import { MediaValidationError } from "@/lib/media/process";
import { deleteUserImage, storeUserImage } from "@/lib/media/service";
import { failure, revalidateUniverse, universeAction } from "@/features/game/context";

const TARGETS = {
  wrestler: { table: "wrestlers", column: "portrait_asset_id", kind: "portrait" },
  promotion: { table: "promotions", column: "logo_asset_id", kind: "promotion_logo" },
  championship: { table: "championships", column: "image_asset_id", kind: "championship" },
  team: { table: "teams", column: "logo_asset_id", kind: "team_logo" },
  venue: { table: "venues", column: "image_asset_id", kind: "venue" },
  show: { table: "shows", column: "poster_asset_id", kind: "event_poster" },
} as const satisfies Record<string, { table: string; column: string; kind: MediaKind }>;
type Target = keyof typeof TARGETS;
const targetSchema = z.enum(Object.keys(TARGETS) as [Target, ...Target[]]);

async function currentAsset(ctx: Awaited<ReturnType<typeof universeAction>>, target: Target, entityId: string): Promise<{ found: boolean; assetId: string | null }> {
  const t = TARGETS[target];
  // Dynamic table/column: typed loosely, values come from the fixed map above.
  const { data } = await (ctx.supabase.from(t.table) as unknown as {
    select: (c: string) => { eq: (k: string, v: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: Record<string, string | null> | null }> } } };
  })
    .select(`id, ${t.column}`)
    .eq("id", entityId)
    .eq("universe_id", ctx.universeId)
    .maybeSingle();
  return { found: Boolean(data), assetId: (data?.[t.column] as string | null) ?? null };
}

async function setAsset(ctx: Awaited<ReturnType<typeof universeAction>>, target: Target, entityId: string, assetId: string | null) {
  const t = TARGETS[target];
  const { error } = await (ctx.supabase.from(t.table) as unknown as {
    update: (v: Record<string, string | null>) => { eq: (k: string, v: string) => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> } };
  })
    .update({ [t.column]: assetId })
    .eq("id", entityId)
    .eq("universe_id", ctx.universeId);
  if (error) throw error;
}

export async function uploadEntityImageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await universeAction(formData);
    const target = targetSchema.parse(formData.get("target"));
    const entityId = z.uuid().parse(formData.get("entityId"));
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "Choose an image to upload." };
    const existing = await currentAsset(ctx, target, entityId);
    if (!existing.found) return { error: "Not found." };
    const assetId = await storeUserImage(ctx.supabase, ctx.userId, file, TARGETS[target].kind);
    await setAsset(ctx, target, entityId, assetId);
    if (existing.assetId) await deleteUserImage(ctx.userId, existing.assetId);
    revalidateUniverse(ctx.universeId);
    return { ok: true, message: "Image uploaded." };
  } catch (e) {
    if (e instanceof MediaValidationError) return { error: e.message };
    return failure(e);
  }
}

export async function removeEntityImageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await universeAction(formData);
    const target = targetSchema.parse(formData.get("target"));
    const entityId = z.uuid().parse(formData.get("entityId"));
    const existing = await currentAsset(ctx, target, entityId);
    if (!existing.found) return { error: "Not found." };
    await setAsset(ctx, target, entityId, null);
    if (existing.assetId) await deleteUserImage(ctx.userId, existing.assetId);
    revalidateUniverse(ctx.universeId);
    return { ok: true, message: "Image removed. The original placeholder art is back." };
  } catch (e) {
    return failure(e);
  }
}
