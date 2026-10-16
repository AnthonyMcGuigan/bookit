"use server";

import { z } from "zod";
import type { ActionState } from "@/components/forms";
import { AUDIENCE_PROFILES, CONTROLLERS } from "@/lib/domain/enums";
import { addTimeline, check, checked, failure, formFields, invalid, revalidateUniverse, universeAction } from "@/features/game/context";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #b91c1c");
const score = z.coerce.number().int().min(0, "0–100").max(100, "0–100");

const promotionForm = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  abbreviation: z.string().trim().min(1, "Abbreviation is required").max(8),
  tagline: z.string().trim().max(120).default(""),
  description: z.string().max(4000).default(""),
  region: z.string().trim().max(60).default(""),
  audience_profile: z.enum(AUDIENCE_PROFILES),
  primary_color: hex,
  secondary_color: hex,
  reputation: score,
  popularity: score,
  controlled_by: z.enum(CONTROLLERS),
  founded_on: z.iso.date().optional().transform((v) => v ?? null),
});

export async function savePromotionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await universeAction(formData);
    const fields = formFields(formData);
    const parsed = promotionForm.safeParse(fields);
    if (!parsed.success) return invalid(parsed.error);
    const promotionId = fields.promotionId;
    if (promotionId) {
      const res = check(await ctx.supabase.from("promotions").update(parsed.data).eq("id", promotionId).eq("universe_id", ctx.universeId).select("id"));
      if (!res.data?.length) return { error: "Promotion not found." };
      revalidateUniverse(ctx.universeId);
      return { ok: true, message: "Promotion saved." };
    }
    const cash = ctx.settings.financesEnabled ? ctx.settings.startingCapital : 0;
    const res = check(
      await ctx.supabase.from("promotions").insert({ ...parsed.data, universe_id: ctx.universeId, cash_balance: cash, founded_on: parsed.data.founded_on ?? ctx.gameDate }).select("id").single(),
    );
    if (ctx.settings.financesEnabled && cash > 0) {
      check(
        await ctx.supabase.from("financial_transactions").insert({
          universe_id: ctx.universeId, promotion_id: res.data!.id, occurred_on: ctx.gameDate, category: "starting_capital", amount: cash, description: "Starting capital",
        }),
      );
    }
    await addTimeline(ctx, { kind: "business", title: `${parsed.data.name} was founded`, promotion_id: res.data!.id, importance: 3 });
    revalidateUniverse(ctx.universeId);
    return { ok: true, message: `${parsed.data.name} created.`, data: { id: res.data!.id } };
  } catch (e) {
    return failure(e);
  }
}

export async function setPromotionArchivedAction(formData: FormData): Promise<void> {
  const ctx = await universeAction(formData);
  const id = z.uuid().parse(formData.get("promotionId"));
  const archive = checked(formData, "archive");
  check(await ctx.supabase.from("promotions").update({ archived_at: archive ? new Date().toISOString() : null }).eq("id", id).eq("universe_id", ctx.universeId));
  revalidateUniverse(ctx.universeId);
}

const venueForm = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  city: z.string().trim().max(80).default(""),
  region: z.string().trim().max(60).default(""),
  capacity: z.coerce.number().int().min(50, "At least 50").max(150000, "At most 150,000"),
  rental_cost: z.coerce.number().int().min(0).max(10_000_000),
  prestige: score,
});

export async function saveVenueAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await universeAction(formData);
    const fields = formFields(formData);
    const parsed = venueForm.safeParse(fields);
    if (!parsed.success) return invalid(parsed.error);
    if (fields.venueId) {
      const res = check(await ctx.supabase.from("venues").update(parsed.data).eq("id", fields.venueId).eq("universe_id", ctx.universeId).select("id"));
      if (!res.data?.length) return { error: "Venue not found." };
    } else {
      check(await ctx.supabase.from("venues").insert({ ...parsed.data, universe_id: ctx.universeId }));
    }
    revalidateUniverse(ctx.universeId);
    return { ok: true, message: fields.venueId ? "Venue saved." : `${parsed.data.name} added.` };
  } catch (e) {
    return failure(e);
  }
}

export async function setVenueArchivedAction(formData: FormData): Promise<void> {
  const ctx = await universeAction(formData);
  const id = z.uuid().parse(formData.get("venueId"));
  check(await ctx.supabase.from("venues").update({ archived_at: checked(formData, "archive") ? new Date().toISOString() : null }).eq("id", id).eq("universe_id", ctx.universeId));
  revalidateUniverse(ctx.universeId);
}
