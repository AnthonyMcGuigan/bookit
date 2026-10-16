"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/forms";
import { TEAM_KINDS, TEAM_ROLES } from "@/lib/domain/enums";
import { addTimeline, check, failure, formFields, formIds, invalid, revalidateUniverse, universeAction } from "@/features/game/context";

const teamForm = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  kind: z.enum(TEAM_KINDS),
  description: z.string().max(2000).default(""),
  promotion_id: z.uuid().optional().transform((v) => v ?? null),
  formed_on: z.iso.date().optional(),
  experience: z.coerce.number().int().min(0).max(100).default(0),
});

const MIN_MEMBERS = { tag_team: 2, trio: 3, faction: 2 } as const;

export async function saveTeamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let target: string;
  let universeId: string;
  try {
    const ctx = await universeAction(formData);
    universeId = ctx.universeId;
    const fields = formFields(formData);
    const parsed = teamForm.safeParse(fields);
    if (!parsed.success) return invalid(parsed.error);
    if (fields.teamId) {
      const res = check(await ctx.supabase.from("teams").update(parsed.data).eq("id", fields.teamId).eq("universe_id", ctx.universeId).select("id"));
      if (!res.data?.length) return { error: "Team not found." };
      revalidateUniverse(ctx.universeId);
      return { ok: true, message: "Team saved." };
    }
    const members = formIds(formData, "members");
    if (members.length < MIN_MEMBERS[parsed.data.kind]) {
      return { error: `A ${parsed.data.kind.replace("_", " ")} needs at least ${MIN_MEMBERS[parsed.data.kind]} members.`, fieldErrors: { members: ["Choose more members"] } };
    }
    const leader = fields.leader && members.includes(fields.leader) ? fields.leader : null;
    const formed = parsed.data.formed_on ?? ctx.gameDate;
    const res = check(await ctx.supabase.from("teams").insert({ ...parsed.data, formed_on: formed, universe_id: ctx.universeId }).select("id").single());
    target = res.data!.id;
    check(
      await ctx.supabase.from("team_memberships").insert(
        members.map((m) => ({ universe_id: ctx.universeId, team_id: target, wrestler_id: m, role: m === leader ? "leader" : "member", joined_on: formed })),
      ),
    );
    await addTimeline(ctx, { kind: "team_formed", title: `${parsed.data.name} formed`, occurred_on: formed, wrestler_ids: members, promotion_id: parsed.data.promotion_id, importance: 2 });
    revalidateUniverse(ctx.universeId);
  } catch (e) {
    return failure(e);
  }
  redirect(`/u/${universeId}/teams/${target}`);
}

export async function addTeamMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await universeAction(formData);
    const teamId = z.uuid().parse(formData.get("teamId"));
    const fields = formFields(formData);
    const wrestlerId = z.uuid({ message: "Choose a wrestler" }).safeParse(fields.wrestler_id);
    if (!wrestlerId.success) return { error: "Choose a wrestler." };
    const role = z.enum(TEAM_ROLES).catch("member").parse(fields.role);
    const { data: team } = await ctx.supabase.from("teams").select("name, kind, promotion_id").eq("id", teamId).eq("universe_id", ctx.universeId).maybeSingle();
    if (!team) return { error: "Team not found." };
    const open = await ctx.supabase.from("team_memberships").select("id").eq("team_id", teamId).eq("wrestler_id", wrestlerId.data).is("left_on", null).maybeSingle();
    if (open.data) return { error: "They're already a member." };
    check(await ctx.supabase.from("team_memberships").insert({ universe_id: ctx.universeId, team_id: teamId, wrestler_id: wrestlerId.data, role, joined_on: ctx.gameDate }));
    const { data: w } = await ctx.supabase.from("wrestlers").select("ring_name").eq("id", wrestlerId.data).maybeSingle();
    await addTimeline(ctx, { kind: "faction_joined", title: `${w?.ring_name ?? "A wrestler"} joined ${team.name}`, wrestler_ids: [wrestlerId.data], promotion_id: team.promotion_id });
    revalidateUniverse(ctx.universeId);
    return { ok: true, message: `${w?.ring_name} joined ${team.name}.` };
  } catch (e) {
    return failure(e);
  }
}

export async function removeTeamMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await universeAction(formData);
    const membershipId = z.uuid().parse(formData.get("membershipId"));
    const { data: m } = await ctx.supabase.from("team_memberships").select("id, wrestler_id, team_id, joined_on").eq("id", membershipId).eq("universe_id", ctx.universeId).maybeSingle();
    if (!m) return { error: "Membership not found." };
    const leftOn = m.joined_on > ctx.gameDate ? m.joined_on : ctx.gameDate;
    check(await ctx.supabase.from("team_memberships").update({ left_on: leftOn }).eq("id", m.id));
    const [{ data: team }, { data: w }] = await Promise.all([
      ctx.supabase.from("teams").select("name, promotion_id").eq("id", m.team_id).maybeSingle(),
      ctx.supabase.from("wrestlers").select("ring_name").eq("id", m.wrestler_id).maybeSingle(),
    ]);
    await addTimeline(ctx, { kind: "faction_left", title: `${w?.ring_name ?? "A wrestler"} left ${team?.name ?? "their team"}`, wrestler_ids: [m.wrestler_id], promotion_id: team?.promotion_id ?? null });
    revalidateUniverse(ctx.universeId);
    return { ok: true, message: "Member removed. Their time with the team stays in the history." };
  } catch (e) {
    return failure(e);
  }
}

export async function setMemberRoleAction(formData: FormData): Promise<void> {
  const ctx = await universeAction(formData);
  const membershipId = z.uuid().parse(formData.get("membershipId"));
  const role = z.enum(TEAM_ROLES).parse(formData.get("role"));
  check(await ctx.supabase.from("team_memberships").update({ role }).eq("id", membershipId).eq("universe_id", ctx.universeId));
  revalidateUniverse(ctx.universeId);
}

export async function disbandTeamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await universeAction(formData);
    const teamId = z.uuid().parse(formData.get("teamId"));
    const { data: team } = await ctx.supabase.from("teams").select("name, promotion_id, disbanded_on").eq("id", teamId).eq("universe_id", ctx.universeId).maybeSingle();
    if (!team) return { error: "Team not found." };
    if (team.disbanded_on) {
      check(await ctx.supabase.from("teams").update({ disbanded_on: null }).eq("id", teamId));
      revalidateUniverse(ctx.universeId);
      return { ok: true, message: `${team.name} reunited. Add members back from the list below.` };
    }
    const { data: members } = await ctx.supabase.from("team_memberships").select("wrestler_id").eq("team_id", teamId).is("left_on", null);
    check(await ctx.supabase.from("team_memberships").update({ left_on: ctx.gameDate }).eq("team_id", teamId).is("left_on", null).lte("joined_on", ctx.gameDate));
    check(await ctx.supabase.from("teams").update({ disbanded_on: ctx.gameDate }).eq("id", teamId));
    await addTimeline(ctx, { kind: "team_disbanded", title: `${team.name} disbanded`, wrestler_ids: (members ?? []).map((m) => m.wrestler_id), promotion_id: team.promotion_id, importance: 3 });
    revalidateUniverse(ctx.universeId);
    return { ok: true, message: `${team.name} disbanded.` };
  } catch (e) {
    return failure(e);
  }
}
