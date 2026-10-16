"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/forms";
import { SHOW_TYPES } from "@/lib/domain/enums";
import { loadUniverseState } from "@/lib/storage/universe-repo";
import { addDays } from "@/lib/domain/dates";
import { autoBookShow } from "@/lib/simulation/ai-booker";
import { runSimulation } from "@/lib/game/simulate";
import { check, failure, formFields, invalid, revalidateUniverse, universeAction, type UniverseActionContext } from "@/features/game/context";
import { segmentPayloadSchema } from "./segment-schema";

const uuid = z.uuid();

const showForm = z.object({
  promotion_id: z.uuid("Choose a promotion"),
  name: z.string().trim().min(1, "Name is required").max(80),
  show_type: z.enum(SHOW_TYPES),
  custom_type_label: z.string().trim().max(40).default(""),
  show_date: z.iso.date("Choose a date"),
  venue_id: z.uuid().optional().transform((v) => v ?? null),
  target_duration_min: z.coerce.number().int().min(15, "15–600 minutes").max(600, "15–600 minutes"),
  ticket_price: z.coerce.number().int().min(0).max(1000),
  notes: z.string().max(2000).default(""),
});

async function loadShow(ctx: UniverseActionContext, showId: string) {
  const { data } = await ctx.supabase.from("shows").select("id, status, version, promotion_id, show_date, name").eq("id", showId).eq("universe_id", ctx.universeId).maybeSingle();
  if (!data) throw new Error("SHOW_NOT_FOUND");
  return data;
}

async function editableShow(ctx: UniverseActionContext, showId: string) {
  const show = await loadShow(ctx, showId);
  if (show.status === "completed") throw new Error("SHOW_ALREADY_SIMULATED");
  return show;
}

/** Bumps the show version so a simulation planned against an older card is rejected. */
async function touchShow(ctx: UniverseActionContext, show: { id: string; version: number }) {
  check(await ctx.supabase.from("shows").update({ version: show.version + 1 }).eq("id", show.id).eq("version", show.version));
}

export async function saveShowAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let target: string;
  let universeId: string;
  try {
    const ctx = await universeAction(formData);
    universeId = ctx.universeId;
    const fields = formFields(formData);
    const parsed = showForm.safeParse(fields);
    if (!parsed.success) return invalid(parsed.error);
    if (parsed.data.show_date < ctx.gameDate) return { error: "Shows must be scheduled on or after the current universe date.", fieldErrors: { show_date: ["Too early"] } };
    const { data: promotion } = await ctx.supabase.from("promotions").select("id").eq("id", parsed.data.promotion_id).eq("universe_id", ctx.universeId).maybeSingle();
    if (!promotion) return { error: "Promotion not found." };
    if (fields.showId) {
      const show = await editableShow(ctx, fields.showId);
      check(await ctx.supabase.from("shows").update({ ...parsed.data, version: show.version + 1 }).eq("id", show.id));
      revalidateUniverse(ctx.universeId);
      return { ok: true, message: "Show details saved." };
    }
    const res = check(await ctx.supabase.from("shows").insert({ ...parsed.data, universe_id: ctx.universeId, status: "draft" }).select("id").single());
    target = res.data!.id;
    revalidateUniverse(ctx.universeId);
  } catch (e) {
    return failure(e);
  }
  redirect(`/u/${universeId}/booking/${target}`);
}

export async function setShowStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await universeAction(formData);
    const show = await editableShow(ctx, uuid.parse(formData.get("showId")));
    const status = z.enum(["draft", "booked", "cancelled"]).parse(formData.get("status"));
    check(await ctx.supabase.from("shows").update({ status, version: show.version + 1 }).eq("id", show.id));
    revalidateUniverse(ctx.universeId);
    return { ok: true, message: status === "booked" ? "Card locked in." : status === "cancelled" ? "Show cancelled." : "Show reopened for booking." };
  } catch (e) {
    return failure(e);
  }
}

export async function deleteShowAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let universeId: string;
  try {
    const ctx = await universeAction(formData);
    universeId = ctx.universeId;
    const show = await editableShow(ctx, uuid.parse(formData.get("showId")));
    check(await ctx.supabase.from("shows").delete().eq("id", show.id).neq("status", "completed"));
    revalidateUniverse(ctx.universeId);
  } catch (e) {
    return failure(e);
  }
  redirect(`/u/${universeId}/booking`);
}

export async function saveSegmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let universeId: string;
  let showId: string;
  try {
    const ctx = await universeAction(formData);
    universeId = ctx.universeId;
    const show = await editableShow(ctx, uuid.parse(formData.get("showId")));
    showId = show.id;
    let raw: unknown;
    try {
      raw = JSON.parse(String(formData.get("payload") ?? ""));
    } catch {
      return { error: "The segment couldn't be read. Please try again." };
    }
    const parsed = segmentPayloadSchema.safeParse(raw);
    if (!parsed.success) return invalid(parsed.error, parsed.error.issues[0]?.message ?? "Please check the segment.");
    const p = parsed.data;
    const isMatch = p.kind === "match";
    // Validate references belong to this universe.
    const wrestlerIds = [...new Set([...p.sides.flatMap((s) => s.members.map((m) => m.wrestler_id)), ...p.interference.map((i) => i.wrestlerId)])];
    if (wrestlerIds.length) {
      const { count } = await ctx.supabase.from("wrestlers").select("id", { count: "exact", head: true }).eq("universe_id", ctx.universeId).in("id", wrestlerIds);
      if (count !== wrestlerIds.length) return { error: "One of the chosen wrestlers no longer exists." };
    }
    const row = {
      kind: p.kind,
      title: p.title,
      custom_kind_label: p.kind === "custom" ? p.custom_kind_label : "",
      description: p.description,
      duration_min: p.duration_min,
      storyline_id: p.storyline_id,
      match_type: isMatch ? p.match_type : null,
      stipulation: isMatch ? (p.stipulation ?? "standard") : null,
      championship_id: isMatch ? p.championship_id : null,
      stakes: p.stakes,
      finish_plan: isMatch ? (p.finish_plan ?? "auto") : null,
      predetermined_winner_side: isMatch ? p.predetermined_winner_side : null,
      interference: isMatch ? p.interference : [],
      title_changes_on_dq: isMatch ? p.title_changes_on_dq : false,
    };
    let segmentId = String(formData.get("segmentId") ?? "");
    if (segmentId) {
      if (!uuid.safeParse(segmentId).success) return { error: "Segment not found." };
      const res = check(await ctx.supabase.from("segments").update(row).eq("id", segmentId).eq("show_id", show.id).select("id"));
      if (!res.data?.length) return { error: "Segment not found." };
      check(await ctx.supabase.from("segment_participants").delete().eq("segment_id", segmentId));
    } else {
      const { data: last } = await ctx.supabase.from("segments").select("position").eq("show_id", show.id).order("position", { ascending: false }).limit(1).maybeSingle();
      const res = check(await ctx.supabase.from("segments").insert({ ...row, universe_id: ctx.universeId, show_id: show.id, position: (last?.position ?? -1) + 1 }).select("id").single());
      segmentId = res.data!.id;
    }
    const participants = p.sides.flatMap((side, index) =>
      side.members.map((m) => ({
        universe_id: ctx.universeId,
        segment_id: segmentId,
        wrestler_id: m.wrestler_id,
        side: index,
        team_id: side.team_id,
        role: isMatch ? m.role : m.role === "competitor" ? "participant" : m.role,
      })),
    );
    if (participants.length) check(await ctx.supabase.from("segment_participants").insert(participants));
    await touchShow(ctx, show);
    revalidateUniverse(ctx.universeId);
  } catch (e) {
    return failure(e);
  }
  redirect(`/u/${universeId}/booking/${showId}`);
}

export async function deleteSegmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await universeAction(formData);
    const show = await editableShow(ctx, uuid.parse(formData.get("showId")));
    check(await ctx.supabase.from("segments").delete().eq("id", uuid.parse(formData.get("segmentId"))).eq("show_id", show.id));
    await touchShow(ctx, show);
    revalidateUniverse(ctx.universeId);
    return { ok: true, message: "Segment removed." };
  } catch (e) {
    return failure(e);
  }
}

/** Persists a new running order (array of segment ids, first = opener). */
export async function reorderSegmentsAction(universeIdInput: string, showIdInput: string, order: string[]): Promise<ActionState> {
  try {
    const fd = new FormData();
    fd.set("universeId", universeIdInput);
    const ctx = await universeAction(fd);
    const show = await editableShow(ctx, uuid.parse(showIdInput));
    const ids = z.array(uuid).max(60).parse(order);
    const { data: existing } = await ctx.supabase.from("segments").select("id").eq("show_id", show.id);
    const known = new Set((existing ?? []).map((s) => s.id));
    if (ids.length !== known.size || ids.some((id) => !known.has(id))) return { error: "The card changed. Reload and try again." };
    // Two passes avoid transient duplicate positions if a unique index is added later.
    for (const [i, id] of ids.entries()) check(await ctx.supabase.from("segments").update({ position: 1000 + i }).eq("id", id));
    for (const [i, id] of ids.entries()) check(await ctx.supabase.from("segments").update({ position: i }).eq("id", id));
    await touchShow(ctx, show);
    revalidateUniverse(ctx.universeId);
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

export async function autoBookAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await universeAction(formData);
    const show = await editableShow(ctx, uuid.parse(formData.get("showId")));
    const state = await loadUniverseState(ctx.supabase, ctx.universeId, { historyFrom: addDays(ctx.gameDate, -60) });
    const full = state.shows.find((s) => s.id === show.id)!;
    const replace = formData.get("replace") === "true";
    const existing = state.segments.filter((s) => s.show_id === show.id);
    if (existing.length && !replace) return { error: "The card already has segments. Clear it or choose “Replace card”." };
    const booked = autoBookShow(
      { ...state, segments: state.segments.filter((s) => s.show_id !== show.id) },
      { promotionId: full.promotion_id, date: full.show_date, showType: full.show_type, name: full.name, seed: `${show.id}:auto:${show.version}`, venueId: full.venue_id, existingShow: full },
    );
    if (booked.segments.length === 0) return { error: "Not enough healthy wrestlers on the roster to build a card." };
    if (existing.length) check(await ctx.supabase.from("segments").delete().eq("show_id", show.id));
    const idMap = new Map(booked.segments.map((s) => [s.id, crypto.randomUUID()]));
    check(
      await ctx.supabase.from("segments").insert(
        booked.segments.map(({ id, created_at: _c, updated_at: _u, ...s }) => ({ ...s, id: idMap.get(id)!, universe_id: ctx.universeId })),
      ),
    );
    check(
      await ctx.supabase.from("segment_participants").insert(
        booked.participants.map(({ id: _id, created_at: _c, updated_at: _u, ...p }) => ({ ...p, segment_id: idMap.get(p.segment_id)!, universe_id: ctx.universeId })),
      ),
    );
    await touchShow(ctx, show);
    revalidateUniverse(ctx.universeId);
    return { ok: true, message: `Booked ${booked.segments.length} segments. Adjust anything you like.` };
  } catch (e) {
    return failure(e);
  }
}

export async function simulateShowAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let universeId: string;
  let showId: string;
  try {
    const ctx = await universeAction(formData);
    universeId = ctx.universeId;
    showId = uuid.parse(formData.get("showId"));
    await runSimulation(ctx.supabase, ctx.universeId, { showId });
    revalidateUniverse(ctx.universeId);
  } catch (e) {
    return failure(e);
  }
  redirect(`/u/${universeId}/booking/${showId}?simulated=1`);
}

export async function advanceTimeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await universeAction(formData);
    const days = z.coerce.number().int().min(1).max(60).parse(formData.get("days"));
    const plan = await runSimulation(ctx.supabase, ctx.universeId, { toDate: addDays(ctx.gameDate, days) });
    revalidateUniverse(ctx.universeId);
    return { ok: true, message: `Advanced ${days} day(s).${plan.rivalShows.length ? ` Rivals ran ${plan.rivalShows.length} show(s).` : ""}` };
  } catch (e) {
    return failure(e);
  }
}

const resultEdit = z.object({
  winner_side: z.string().optional().transform((v) => (v === undefined || v === "" ? null : Number(v))),
  star_rating: z.coerce.number().min(0).max(5),
  recap: z.string().max(4000).default(""),
});

/** Manual result override. Never re-simulates consequences (titles, stats). */
export async function editResultAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await universeAction(formData);
    const segmentId = uuid.parse(formData.get("segmentId"));
    const parsed = resultEdit.safeParse(formFields(formData));
    if (!parsed.success) return invalid(parsed.error);
    if (formData.get("acknowledge") !== "on") return { error: "Tick “I understand” to confirm editing a recorded result.", fieldErrors: { acknowledge: ["Required"] } };
    const { data: result } = await ctx.supabase.from("segment_results").select("segment_id, winner_side").eq("segment_id", segmentId).eq("universe_id", ctx.universeId).maybeSingle();
    if (!result) return { error: "Result not found." };
    const { data: parts } = await ctx.supabase.from("segment_participants").select("id, side, role").eq("segment_id", segmentId);
    const winner = parsed.data.winner_side;
    if (winner !== null && !(parts ?? []).some((p) => p.side === winner)) return { error: "That side isn't in the match." };
    check(
      await ctx.supabase
        .from("segment_results")
        .update({ winner_side: winner, star_rating: Math.round(parsed.data.star_rating * 4) / 4, quality: Math.round(parsed.data.star_rating * 20), recap: parsed.data.recap, manually_edited: true })
        .eq("segment_id", segmentId),
    );
    if (winner !== result.winner_side) {
      for (const p of parts ?? []) {
        if (p.role !== "competitor") continue;
        check(await ctx.supabase.from("segment_participants").update({ outcome: winner === null ? "draw" : p.side === winner ? "win" : "loss" }).eq("id", p.id));
      }
    }
    revalidateUniverse(ctx.universeId);
    return { ok: true, message: "Result updated. Championships, stats and storylines were not recalculated." };
  } catch (e) {
    return failure(e);
  }
}
