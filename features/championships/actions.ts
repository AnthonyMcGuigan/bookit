"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/forms";
import { CARD_POSITIONS, CHAMPIONSHIP_FORMATS, CHAMPIONSHIP_TIERS, DIVISIONS } from "@/lib/domain/enums";
import {
  addTimeline,
  check,
  checked,
  failure,
  formFields,
  formIds,
  invalid,
  revalidateUniverse,
  universeAction,
  type UniverseActionContext,
} from "@/features/game/context";

const HOLDERS = { singles: 1, tag: 2, trios: 3 } as const;

const championshipForm = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  promotion_id: z.uuid("Choose a promotion"),
  description: z.string().max(2000).default(""),
  division: z.enum(DIVISIONS),
  format: z.enum(CHAMPIONSHIP_FORMATS),
  tier: z.enum(CHAMPIONSHIP_TIERS),
  prestige: z.coerce.number().int().min(0, "0–100").max(100, "0–100"),
  established_on: z.iso.date().optional(),
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
  eligibility_notes: z.string().max(300).optional(),
});

export async function saveChampionshipAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let target: string;
  let universeId: string;
  try {
    const ctx = await universeAction(formData);
    universeId = ctx.universeId;
    const fields = formFields(formData);
    const parsed = championshipForm.safeParse(fields);
    if (!parsed.success) return invalid(parsed.error);
    const { eligibility_notes, ...data } = parsed.data;
    const eligibility = {
      divisions: formData.getAll("elig_divisions").map(String).filter((d) => (DIVISIONS as readonly string[]).includes(d)),
      cardPositions: formData.getAll("elig_positions").map(String).filter((d) => (CARD_POSITIONS as readonly string[]).includes(d)),
      notes: eligibility_notes ?? "",
    };
    const row = { ...data, established_on: data.established_on ?? ctx.gameDate, eligibility };
    if (fields.championshipId) {
      const res = check(await ctx.supabase.from("championships").update(row).eq("id", fields.championshipId).eq("universe_id", ctx.universeId).select("id"));
      if (!res.data?.length) return { error: "Championship not found." };
      revalidateUniverse(ctx.universeId);
      return { ok: true, message: "Championship saved." };
    }
    const res = check(await ctx.supabase.from("championships").insert({ ...row, universe_id: ctx.universeId, status: "active" }).select("id").single());
    target = res.data!.id;
    const holders = formIds(formData, "holders");
    if (holders.length > 0) {
      if (holders.length !== HOLDERS[data.format]) {
        return { error: `Created the championship, but a ${data.format} title needs exactly ${HOLDERS[data.format]} holder(s). Award it from the championship page.` };
      }
      await createReign(ctx, { championshipId: target, name: data.name, promotionId: data.promotion_id, holders, teamId: null, startedOn: row.established_on, notes: "Inaugural champion" });
    }
    revalidateUniverse(ctx.universeId);
  } catch (e) {
    return failure(e);
  }
  redirect(`/u/${universeId}/championships/${target}`);
}

async function createReign(
  ctx: UniverseActionContext,
  input: { championshipId: string; name: string; promotionId: string; holders: string[]; teamId: string | null; startedOn: string; notes: string },
) {
  const reign = check(
    await ctx.supabase
      .from("title_reigns")
      .insert({ universe_id: ctx.universeId, championship_id: input.championshipId, team_id: input.teamId, started_on: input.startedOn, notes: input.notes.slice(0, 500), is_manual: true })
      .select("id")
      .single(),
  );
  check(await ctx.supabase.from("title_reign_holders").insert(input.holders.map((h) => ({ universe_id: ctx.universeId, reign_id: reign.data!.id, wrestler_id: h }))));
  const { data: names } = await ctx.supabase.from("wrestlers").select("ring_name").in("id", input.holders);
  await addTimeline(ctx, {
    kind: "title_change",
    title: `${(names ?? []).map((n) => n.ring_name).join(" & ")} awarded the ${input.name}`,
    summary: input.notes || "Awarded by management decision.",
    occurred_on: input.startedOn,
    promotion_id: input.promotionId,
    wrestler_ids: input.holders,
    championship_id: input.championshipId,
    importance: 4,
  });
  return reign.data!.id;
}

async function loadChampionship(ctx: UniverseActionContext, id: string) {
  const { data } = await ctx.supabase.from("championships").select("id, name, format, division, promotion_id, status").eq("id", id).eq("universe_id", ctx.universeId).maybeSingle();
  if (!data) throw new Error("NOT_FOUND");
  return data;
}

const vacateSchema = z.object({
  reason: z.enum(["vacated", "stripped", "injury"]),
  note: z.string().max(500).optional(),
});

export async function vacateChampionshipAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await universeAction(formData);
    const championship = await loadChampionship(ctx, z.uuid().parse(formData.get("championshipId")));
    const parsed = vacateSchema.safeParse(formFields(formData));
    if (!parsed.success) return invalid(parsed.error);
    const { data: current } = await ctx.supabase.from("title_reigns").select("id, started_on, notes").eq("championship_id", championship.id).is("ended_on", null).maybeSingle();
    if (!current) return { error: "The championship is already vacant." };
    const endedOn = current.started_on > ctx.gameDate ? current.started_on : ctx.gameDate;
    check(await ctx.supabase.from("title_reigns").update({ ended_on: endedOn, end_reason: parsed.data.reason }).eq("id", current.id));
    const { data: holders } = await ctx.supabase.from("title_reign_holders").select("wrestler_id").eq("reign_id", current.id);
    const { data: holderNames } = await ctx.supabase.from("wrestlers").select("ring_name").in("id", (holders ?? []).map((h) => h.wrestler_id));
    const names = (holderNames ?? []).map((h) => h.ring_name).join(" & ");
    await addTimeline(ctx, {
      kind: "title_vacated",
      title: `The ${championship.name} was ${parsed.data.reason === "stripped" ? `stripped from ${names}` : parsed.data.reason === "injury" ? `vacated due to ${names}'s injury` : "vacated"}`,
      summary: parsed.data.note ?? "",
      occurred_on: endedOn,
      promotion_id: championship.promotion_id,
      wrestler_ids: (holders ?? []).map((h) => h.wrestler_id),
      championship_id: championship.id,
      importance: 4,
    });
    revalidateUniverse(ctx.universeId);
    return { ok: true, message: "Championship vacated. Book a match for it or award it manually." };
  } catch (e) {
    return failure(e);
  }
}

const awardSchema = z.object({
  started_on: z.iso.date().optional(),
  team_id: z.uuid().optional(),
  notes: z.string().max(500).default(""),
});

export async function awardChampionshipAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await universeAction(formData);
    const championship = await loadChampionship(ctx, z.uuid().parse(formData.get("championshipId")));
    if (championship.status === "retired") return { error: "This championship is retired. Reactivate it first." };
    const parsed = awardSchema.safeParse(formFields(formData));
    if (!parsed.success) return invalid(parsed.error);
    const startedOn = parsed.data.started_on ?? ctx.gameDate;
    const need = HOLDERS[championship.format as keyof typeof HOLDERS];
    let holders = formIds(formData, "holders");
    const teamId = parsed.data.team_id ?? null;
    if (teamId && holders.length === 0) {
      const { data: members } = await ctx.supabase.from("team_memberships").select("wrestler_id, role").eq("team_id", teamId).is("left_on", null);
      holders = (members ?? []).filter((m) => m.role !== "manager").map((m) => m.wrestler_id).slice(0, need);
    }
    if (holders.length !== need) return { error: `Choose exactly ${need} holder(s) for this ${championship.format} championship.`, fieldErrors: { holders: [`Choose ${need}`] } };

    const { data: reigns } = await ctx.supabase.from("title_reigns").select("id, started_on, ended_on").eq("championship_id", championship.id).order("started_on");
    const current = (reigns ?? []).find((r) => r.ended_on === null);
    const later = (reigns ?? []).filter((r) => r.started_on > startedOn);
    const warnings: string[] = [];
    if (startedOn < ctx.gameDate) warnings.push("The start date is in the past, so this rewrites recorded history.");
    if (later.length > 0) warnings.push(`${later.length} existing reign(s) start after this date and will overlap. Edit or delete them afterwards.`);
    const { data: holderRows } = await ctx.supabase.from("wrestlers").select("id, ring_name, division, career_status").in("id", holders);
    for (const h of holderRows ?? []) {
      if (championship.division !== "open" && h.division !== "open" && h.division !== championship.division) warnings.push(`${h.ring_name} is not in the ${championship.division} division.`);
      if (h.career_status !== "active") warnings.push(`${h.ring_name} is ${h.career_status}.`);
    }
    if (warnings.length > 0 && !checked(formData, "acknowledge")) {
      return { error: `Please confirm: ${warnings.join(" ")} Tick “I understand” and submit again.`, fieldErrors: { acknowledge: ["Confirmation required"] } };
    }
    if (current) {
      if (current.started_on > startedOn) return { error: "The current reign started after that date. Edit the current reign's dates first." };
      check(await ctx.supabase.from("title_reigns").update({ ended_on: startedOn, end_reason: "manual" }).eq("id", current.id));
    }
    await createReign(ctx, { championshipId: championship.id, name: championship.name, promotionId: championship.promotion_id, holders, teamId, startedOn, notes: parsed.data.notes });
    revalidateUniverse(ctx.universeId);
    return { ok: true, message: "New champion recorded." };
  } catch (e) {
    return failure(e);
  }
}

const reignEditSchema = z.object({
  started_on: z.iso.date("Start date is required"),
  ended_on: z.iso.date().optional().transform((v) => v ?? null),
  end_reason: z.enum(["lost", "vacated", "stripped", "retired", "injury", "manual"]).optional().transform((v) => v ?? null),
  defenses: z.coerce.number().int().min(0).max(999),
  notes: z.string().max(500).default(""),
});

export async function updateReignAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await universeAction(formData);
    const reignId = z.uuid().parse(formData.get("reignId"));
    const parsed = reignEditSchema.safeParse(formFields(formData));
    if (!parsed.success) return invalid(parsed.error);
    if (!checked(formData, "acknowledge")) return { error: "Editing a reign changes recorded history. Tick “I understand” to save.", fieldErrors: { acknowledge: ["Confirmation required"] } };
    const d = parsed.data;
    if (d.ended_on && d.ended_on < d.started_on) return { error: "A reign can't end before it starts." };
    if (d.ended_on && d.ended_on > ctx.gameDate) return { error: "A reign can't end in the future." };
    const { data: reign } = await ctx.supabase.from("title_reigns").select("id, championship_id").eq("id", reignId).eq("universe_id", ctx.universeId).maybeSingle();
    if (!reign) return { error: "Reign not found." };
    const { data: siblings } = await ctx.supabase.from("title_reigns").select("id, started_on, ended_on").eq("championship_id", reign.championship_id).neq("id", reignId);
    const end = d.ended_on ?? "9999-12-31";
    const overlap = (siblings ?? []).find((s) => s.started_on < end && (s.ended_on ?? "9999-12-31") > d.started_on);
    if (overlap) return { error: `Those dates overlap another reign (${overlap.started_on} – ${overlap.ended_on ?? "present"}). Adjust that reign first.` };
    check(
      await ctx.supabase
        .from("title_reigns")
        .update({ started_on: d.started_on, ended_on: d.ended_on, end_reason: d.ended_on ? (d.end_reason ?? "manual") : null, defenses: d.defenses, notes: d.notes, is_manual: true })
        .eq("id", reignId),
    );
    revalidateUniverse(ctx.universeId);
    return { ok: true, message: "Reign updated. Past match results were not changed." };
  } catch (e) {
    return failure(e);
  }
}

export async function deleteReignAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await universeAction(formData);
    const reignId = z.uuid().parse(formData.get("reignId"));
    check(await ctx.supabase.from("title_reigns").delete().eq("id", reignId).eq("universe_id", ctx.universeId));
    revalidateUniverse(ctx.universeId);
    return { ok: true, message: "Reign removed from the lineage. Past match results were not changed." };
  } catch (e) {
    return failure(e);
  }
}

export async function setChampionshipStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await universeAction(formData);
    const championship = await loadChampionship(ctx, z.uuid().parse(formData.get("championshipId")));
    if (championship.status === "active") {
      check(await ctx.supabase.from("title_reigns").update({ ended_on: ctx.gameDate, end_reason: "retired" }).eq("championship_id", championship.id).is("ended_on", null).lte("started_on", ctx.gameDate));
      check(await ctx.supabase.from("championships").update({ status: "retired", retired_on: ctx.gameDate }).eq("id", championship.id));
      await addTimeline(ctx, { kind: "title_vacated", title: `The ${championship.name} was retired`, promotion_id: championship.promotion_id, championship_id: championship.id, importance: 3 });
    } else {
      check(await ctx.supabase.from("championships").update({ status: "active", retired_on: null }).eq("id", championship.id));
    }
    revalidateUniverse(ctx.universeId);
    return { ok: true, message: championship.status === "active" ? "Championship retired." : "Championship reactivated. It is vacant until awarded or won." };
  } catch (e) {
    return failure(e);
  }
}

export async function deleteChampionshipAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let universeId: string;
  try {
    const ctx = await universeAction(formData);
    universeId = ctx.universeId;
    const championship = await loadChampionship(ctx, z.uuid().parse(formData.get("championshipId")));
    if (String(formData.get("confirmName") ?? "").trim() !== championship.name) return { error: `Type "${championship.name}" to confirm.` };
    check(await ctx.supabase.from("championships").delete().eq("id", championship.id));
    revalidateUniverse(ctx.universeId);
  } catch (e) {
    return failure(e);
  }
  redirect(`/u/${universeId}/championships`);
}

