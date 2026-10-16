"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/forms";
import { addDays } from "@/lib/domain/dates";
import {
  addTimeline,
  check,
  checked,
  failure,
  formFields,
  invalid,
  revalidateUniverse,
  universeAction,
  type UniverseActionContext,
} from "@/features/game/context";
import { contractFormSchema, wrestlerFormSchema } from "./schema";

const uuid = z.uuid();

export async function saveWrestlerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let target: string;
  let universeId: string;
  try {
    const ctx = await universeAction(formData);
    const fields = formFields(formData);
    const parsed = wrestlerFormSchema.safeParse(fields);
    if (!parsed.success) return invalid(parsed.error);
    const wrestlerId = fields.wrestlerId;
    if (wrestlerId) {
      if (!uuid.safeParse(wrestlerId).success) return { error: "Wrestler not found." };
      const res = check(await ctx.supabase.from("wrestlers").update(parsed.data).eq("id", wrestlerId).eq("universe_id", ctx.universeId).select("id"));
      if (!res.data?.length) return { error: "Wrestler not found." };
      target = wrestlerId;
    } else {
      const res = check(await ctx.supabase.from("wrestlers").insert({ ...parsed.data, universe_id: ctx.universeId, fatigue: 0 }).select("id").single());
      target = res.data!.id;
      // Optional immediate signing.
      if (fields.promotion_id) {
        const contract = contractFormSchema.safeParse(fields);
        if (contract.success) await signWrestler(ctx, target, contract.data, parsed.data.ring_name);
      }
    }
    revalidateUniverse(ctx.universeId);
    universeId = ctx.universeId;
  } catch (e) {
    return failure(e);
  }
  redirect(`/u/${universeId}/roster/${target}`);
}

async function signWrestler(
  ctx: UniverseActionContext,
  wrestlerId: string,
  input: z.infer<typeof contractFormSchema>,
  ringName: string,
  reason: "signing" | "transfer" = "signing",
) {
  const { data: promotion } = await ctx.supabase.from("promotions").select("id, name").eq("id", input.promotion_id).eq("universe_id", ctx.universeId).maybeSingle();
  if (!promotion) throw new Error("FORBIDDEN");
  const existing = await ctx.supabase
    .from("roster_memberships")
    .select("id")
    .eq("wrestler_id", wrestlerId)
    .eq("promotion_id", promotion.id)
    .is("ended_on", null)
    .maybeSingle();
  if (existing.data) return { already: true, promotion };
  check(
    await ctx.supabase.from("roster_memberships").insert({ universe_id: ctx.universeId, wrestler_id: wrestlerId, promotion_id: promotion.id, started_on: ctx.gameDate }),
  );
  check(
    await ctx.supabase.from("contracts").insert({
      universe_id: ctx.universeId,
      wrestler_id: wrestlerId,
      promotion_id: promotion.id,
      starts_on: ctx.gameDate,
      ends_on: addDays(ctx.gameDate, Math.round(input.months * 30.4)),
      weekly_salary: input.weekly_salary,
      appearance_fee: input.appearance_fee,
      exclusive: true,
      status: "active",
    }),
  );
  if (reason === "signing") {
    await addTimeline(ctx, {
      kind: "signing",
      title: `${promotion.name} signed ${ringName}`,
      summary: `${input.months}-month deal${ctx.settings.financesEnabled ? ` at ${input.weekly_salary.toLocaleString("en-US")} per week` : ""}.`,
      promotion_id: promotion.id,
      wrestler_ids: [wrestlerId],
    });
  }
  return { already: false, promotion };
}

async function endMembership(ctx: UniverseActionContext, wrestlerId: string, promotionId: string, reason: "released" | "transferred" | "retired" | "manual") {
  check(
    await ctx.supabase
      .from("roster_memberships")
      .update({ ended_on: ctx.gameDate, end_reason: reason })
      .eq("wrestler_id", wrestlerId)
      .eq("promotion_id", promotionId)
      .eq("universe_id", ctx.universeId)
      .is("ended_on", null),
  );
  check(
    await ctx.supabase
      .from("contracts")
      .update({ status: "terminated", ends_on: ctx.gameDate })
      .eq("wrestler_id", wrestlerId)
      .eq("promotion_id", promotionId)
      .eq("universe_id", ctx.universeId)
      .eq("status", "active")
      .gte("ends_on", ctx.gameDate),
  );
}

async function wrestlerName(ctx: UniverseActionContext, wrestlerId: string): Promise<string> {
  const { data } = await ctx.supabase.from("wrestlers").select("ring_name").eq("id", wrestlerId).eq("universe_id", ctx.universeId).maybeSingle();
  if (!data) throw new Error("WRESTLER_NOT_FOUND");
  return data.ring_name;
}

export async function signContractAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await universeAction(formData);
    const wrestlerId = uuid.parse(formData.get("wrestlerId"));
    const parsed = contractFormSchema.safeParse(formFields(formData));
    if (!parsed.success) return invalid(parsed.error);
    const name = await wrestlerName(ctx, wrestlerId);
    const result = await signWrestler(ctx, wrestlerId, parsed.data, name);
    revalidateUniverse(ctx.universeId);
    if (result.already) return { error: `${name} is already signed to ${result.promotion.name}.` };
    return { ok: true, message: `${name} signed with ${result.promotion.name}.` };
  } catch (e) {
    return failure(e);
  }
}

export async function releaseWrestlerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await universeAction(formData);
    const wrestlerId = uuid.parse(formData.get("wrestlerId"));
    const promotionId = uuid.parse(formData.get("promotionId"));
    const name = await wrestlerName(ctx, wrestlerId);
    const { data: promotion } = await ctx.supabase.from("promotions").select("name").eq("id", promotionId).maybeSingle();
    await endMembership(ctx, wrestlerId, promotionId, "released");
    await addTimeline(ctx, { kind: "release", title: `${promotion?.name ?? "Promotion"} released ${name}`, promotion_id: promotionId, wrestler_ids: [wrestlerId] });
    revalidateUniverse(ctx.universeId);
    return { ok: true, message: `${name} was released and is now a free agent.` };
  } catch (e) {
    return failure(e);
  }
}

export async function transferWrestlerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await universeAction(formData);
    const wrestlerId = uuid.parse(formData.get("wrestlerId"));
    const fromId = uuid.parse(formData.get("fromPromotionId"));
    const parsed = contractFormSchema.safeParse(formFields(formData));
    if (!parsed.success) return invalid(parsed.error);
    if (parsed.data.promotion_id === fromId) return { error: "Choose a different promotion to transfer to." };
    const name = await wrestlerName(ctx, wrestlerId);
    await endMembership(ctx, wrestlerId, fromId, "transferred");
    const { promotion } = await signWrestler(ctx, wrestlerId, parsed.data, name, "transfer");
    const { data: from } = await ctx.supabase.from("promotions").select("name").eq("id", fromId).maybeSingle();
    await addTimeline(ctx, {
      kind: "transfer",
      title: `${name} moved from ${from?.name ?? "their promotion"} to ${promotion.name}`,
      promotion_id: promotion.id,
      wrestler_ids: [wrestlerId],
      importance: 3,
    });
    revalidateUniverse(ctx.universeId);
    return { ok: true, message: `${name} transferred to ${promotion.name}.` };
  } catch (e) {
    return failure(e);
  }
}

export async function setWrestlerArchivedAction(formData: FormData): Promise<void> {
  const ctx = await universeAction(formData);
  const wrestlerId = uuid.parse(formData.get("wrestlerId"));
  const archive = checked(formData, "archive");
  check(
    await ctx.supabase
      .from("wrestlers")
      .update({ archived_at: archive ? new Date().toISOString() : null })
      .eq("id", wrestlerId)
      .eq("universe_id", ctx.universeId),
  );
  revalidateUniverse(ctx.universeId);
}

export async function retireWrestlerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await universeAction(formData);
    const wrestlerId = uuid.parse(formData.get("wrestlerId"));
    const name = await wrestlerName(ctx, wrestlerId);
    const { data: memberships } = await ctx.supabase.from("roster_memberships").select("promotion_id").eq("wrestler_id", wrestlerId).is("ended_on", null);
    for (const m of memberships ?? []) await endMembership(ctx, wrestlerId, m.promotion_id, "retired");
    check(await ctx.supabase.from("wrestlers").update({ career_status: "retired" }).eq("id", wrestlerId));
    await addTimeline(ctx, { kind: "retirement", title: `${name} retired from in-ring competition`, wrestler_ids: [wrestlerId], importance: 4 });
    revalidateUniverse(ctx.universeId);
    return { ok: true, message: `${name} has retired. Any championships they hold are unchanged; vacate them from the Championships page if needed.` };
  } catch (e) {
    return failure(e);
  }
}

const injurySchema = z.object({
  description: z.string().trim().min(1, "Describe the injury").max(120),
  severity: z.enum(["minor", "moderate", "severe", "career_threatening"]),
  weeks: z.coerce.number().int().min(1, "1–104 weeks").max(104, "1–104 weeks"),
});

export async function addInjuryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await universeAction(formData);
    const wrestlerId = uuid.parse(formData.get("wrestlerId"));
    const parsed = injurySchema.safeParse(formFields(formData));
    if (!parsed.success) return invalid(parsed.error);
    const name = await wrestlerName(ctx, wrestlerId);
    const isStoryline = checked(formData, "is_storyline");
    check(
      await ctx.supabase.from("injuries").insert({
        universe_id: ctx.universeId,
        wrestler_id: wrestlerId,
        description: parsed.data.description,
        severity: parsed.data.severity,
        started_on: ctx.gameDate,
        expected_return_on: addDays(ctx.gameDate, parsed.data.weeks * 7),
        is_storyline: isStoryline,
      }),
    );
    await addTimeline(ctx, {
      kind: "injury",
      title: `${name} ${isStoryline ? "(storyline) " : ""}sidelined: ${parsed.data.description}`,
      summary: `Expected out about ${parsed.data.weeks} week(s).`,
      wrestler_ids: [wrestlerId],
    });
    revalidateUniverse(ctx.universeId);
    return { ok: true, message: "Injury recorded." };
  } catch (e) {
    return failure(e);
  }
}

export async function healInjuryAction(formData: FormData): Promise<void> {
  const ctx = await universeAction(formData);
  const injuryId = uuid.parse(formData.get("injuryId"));
  check(await ctx.supabase.from("injuries").update({ healed_on: ctx.gameDate }).eq("id", injuryId).eq("universe_id", ctx.universeId));
  revalidateUniverse(ctx.universeId);
}
