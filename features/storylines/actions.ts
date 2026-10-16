"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/forms";
import { STORYLINE_KINDS, STORYLINE_ROLES, STORYLINE_STATUSES } from "@/lib/domain/enums";
import { addTimeline, check, checked, failure, formFields, invalid, revalidateUniverse, universeAction } from "@/features/game/context";

const storylineForm = z.object({
  title: z.string().trim().min(1, "Title is required").max(100),
  kind: z.enum(STORYLINE_KINDS),
  promotion_id: z.uuid().optional().transform((v) => v ?? null),
  championship_id: z.uuid().optional().transform((v) => v ?? null),
  objective: z.string().max(500).default(""),
  description: z.string().max(4000).default(""),
  intensity: z.coerce.number().int().min(0, "0–100").max(100, "0–100").default(20),
});

export async function saveStorylineAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let target: string;
  let universeId: string;
  try {
    const ctx = await universeAction(formData);
    universeId = ctx.universeId;
    const fields = formFields(formData);
    const parsed = storylineForm.safeParse(fields);
    if (!parsed.success) return invalid(parsed.error);
    const autoProgress = checked(formData, "auto_progress");
    if (fields.storylineId) {
      const res = check(await ctx.supabase.from("storylines").update({ ...parsed.data, auto_progress: autoProgress }).eq("id", fields.storylineId).eq("universe_id", ctx.universeId).select("id"));
      if (!res.data?.length) return { error: "Storyline not found." };
      revalidateUniverse(ctx.universeId);
      return { ok: true, message: "Storyline saved." };
    }
    const sides = [formData.getAll("side0").map(String), formData.getAll("side1").map(String)].map((ids) => ids.filter((v) => z.uuid().safeParse(v).success));
    if (sides.flat().length === 0) return { error: "Add at least one participant.", fieldErrors: { side0: ["Choose participants"] } };
    const res = check(
      await ctx.supabase
        .from("storylines")
        .insert({ ...parsed.data, universe_id: ctx.universeId, status: "building", started_on: ctx.gameDate, auto_progress: autoProgress })
        .select("id")
        .single(),
    );
    target = res.data!.id;
    const rows = sides.flatMap((ids, side) =>
      [...new Set(ids)].map((wrestler_id) => ({ universe_id: ctx.universeId, storyline_id: target, wrestler_id, side, role: side === 0 ? "protagonist" : "antagonist" })),
    );
    check(await ctx.supabase.from("storyline_participants").insert(rows));
    check(
      await ctx.supabase.from("storyline_developments").insert({
        universe_id: ctx.universeId, storyline_id: target, occurred_on: ctx.gameDate, kind: "started", summary: parsed.data.description || parsed.data.objective || `${parsed.data.title} begins.`, intensity_delta: 0,
      }),
    );
    await addTimeline(ctx, { kind: "storyline", title: `New storyline: ${parsed.data.title}`, wrestler_ids: rows.map((r) => r.wrestler_id), promotion_id: parsed.data.promotion_id });
    revalidateUniverse(ctx.universeId);
  } catch (e) {
    return failure(e);
  }
  redirect(`/u/${universeId}/storylines/${target}`);
}

const developmentForm = z.object({
  summary: z.string().trim().min(1, "Describe what happened").max(1000),
  kind: z.enum(["development", "betrayal", "escalation", "setback", "climax", "note"]),
  intensity_delta: z.coerce.number().int().min(-50).max(50).default(0),
});

export async function addDevelopmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await universeAction(formData);
    const storylineId = z.uuid().parse(formData.get("storylineId"));
    const parsed = developmentForm.safeParse(formFields(formData));
    if (!parsed.success) return invalid(parsed.error);
    const { data: s } = await ctx.supabase.from("storylines").select("intensity").eq("id", storylineId).eq("universe_id", ctx.universeId).maybeSingle();
    if (!s) return { error: "Storyline not found." };
    check(await ctx.supabase.from("storyline_developments").insert({ universe_id: ctx.universeId, storyline_id: storylineId, occurred_on: ctx.gameDate, ...parsed.data }));
    const intensity = Math.max(0, Math.min(100, s.intensity + parsed.data.intensity_delta));
    check(await ctx.supabase.from("storylines").update({ intensity, ...(parsed.data.kind === "climax" ? { status: "climax" } : {}) }).eq("id", storylineId));
    revalidateUniverse(ctx.universeId);
    return { ok: true, message: "Development added." };
  } catch (e) {
    return failure(e);
  }
}

const statusForm = z.object({ status: z.enum(STORYLINE_STATUSES), resolution: z.string().max(1000).default("") });

export async function setStorylineStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await universeAction(formData);
    const storylineId = z.uuid().parse(formData.get("storylineId"));
    const parsed = statusForm.safeParse(formFields(formData));
    if (!parsed.success) return invalid(parsed.error);
    const ended = parsed.data.status === "resolved" || parsed.data.status === "abandoned";
    const { data: s } = await ctx.supabase.from("storylines").select("title, promotion_id").eq("id", storylineId).eq("universe_id", ctx.universeId).maybeSingle();
    if (!s) return { error: "Storyline not found." };
    check(
      await ctx.supabase
        .from("storylines")
        .update({ status: parsed.data.status, resolved_on: ended ? ctx.gameDate : null, ...(parsed.data.resolution ? { resolution: parsed.data.resolution } : {}) })
        .eq("id", storylineId),
    );
    if (ended) {
      check(
        await ctx.supabase.from("storyline_developments").insert({
          universe_id: ctx.universeId, storyline_id: storylineId, occurred_on: ctx.gameDate, kind: parsed.data.status === "resolved" ? "resolved" : "note",
          summary: parsed.data.resolution || (parsed.data.status === "resolved" ? "The story reached its conclusion." : "The story was quietly dropped."), intensity_delta: 0,
        }),
      );
      if (parsed.data.status === "resolved") await addTimeline(ctx, { kind: "storyline", title: `${s.title} concluded`, summary: parsed.data.resolution, promotion_id: s.promotion_id, importance: 3 });
    }
    revalidateUniverse(ctx.universeId);
    return { ok: true, message: "Status updated." };
  } catch (e) {
    return failure(e);
  }
}

export async function addParticipantAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await universeAction(formData);
    const storylineId = z.uuid().parse(formData.get("storylineId"));
    const fields = formFields(formData);
    const wrestlerId = z.uuid().safeParse(fields.wrestler_id);
    if (!wrestlerId.success) return { error: "Choose a wrestler." };
    const role = z.enum(STORYLINE_ROLES).catch("participant").parse(fields.role);
    const side = z.coerce.number().int().min(0).max(7).catch(0).parse(fields.side);
    const { data: s } = await ctx.supabase.from("storylines").select("id").eq("id", storylineId).eq("universe_id", ctx.universeId).maybeSingle();
    if (!s) return { error: "Storyline not found." };
    check(await ctx.supabase.from("storyline_participants").insert({ universe_id: ctx.universeId, storyline_id: storylineId, wrestler_id: wrestlerId.data, side, role }));
    revalidateUniverse(ctx.universeId);
    return { ok: true, message: "Participant added." };
  } catch (e) {
    return failure(e);
  }
}

export async function removeParticipantAction(formData: FormData): Promise<void> {
  const ctx = await universeAction(formData);
  check(await ctx.supabase.from("storyline_participants").delete().eq("id", z.uuid().parse(formData.get("participantId"))).eq("universe_id", ctx.universeId));
  revalidateUniverse(ctx.universeId);
}

export async function endRivalryAction(formData: FormData): Promise<void> {
  const ctx = await universeAction(formData);
  check(await ctx.supabase.from("rivalries").update({ ended_on: ctx.gameDate }).eq("id", z.uuid().parse(formData.get("rivalryId"))).eq("universe_id", ctx.universeId).is("ended_on", null));
  revalidateUniverse(ctx.universeId);
}
