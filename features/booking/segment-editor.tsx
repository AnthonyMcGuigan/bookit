"use client";

import { useActionState, useMemo, useState } from "react";
import { FormMessage, SubmitButton, type ActionState } from "@/components/forms";
import { Button, Checkbox, Field, Input, Select, Textarea, cx } from "@/components/ui";
import {
  FINISH_PLAN_LABELS,
  FINISH_PLANS,
  MATCH_TYPE_LABELS,
  MATCH_TYPES,
  SEGMENT_KIND_LABELS,
  SEGMENT_KINDS,
  STIPULATION_LABELS,
  STIPULATIONS,
  type MatchType,
  type SegmentKind,
} from "@/lib/domain/enums";
import { saveSegmentAction } from "./actions";
import type { SegmentPayload } from "./segment-schema";

export interface EditorWrestler {
  id: string;
  name: string;
  signed: boolean;
  promotion: string;
  injured: string | null;
  fatigue: number;
  division: string;
  role: string;
}
export interface EditorOptions {
  wrestlers: EditorWrestler[];
  teams: Array<{ id: string; name: string; memberIds: string[] }>;
  championships: Array<{ id: string; name: string; format: "singles" | "tag" | "trios"; holderIds: string[] }>;
  storylines: Array<{ id: string; title: string; participantIds: string[] }>;
  fatigueWarn: number;
}

type Side = SegmentPayload["sides"][number];

const SHAPE: Partial<Record<MatchType, [number, number]>> = {
  singles: [2, 1],
  tag: [2, 2],
  trios: [2, 3],
  triple_threat: [3, 1],
  fatal_four_way: [4, 1],
  handicap: [2, 1],
  battle_royal: [1, 0],
  rumble: [1, 0],
  multi_person: [2, 1],
  tournament: [2, 1],
};
const NON_MATCH_SIDES: Partial<Record<SegmentKind, number>> = { confrontation: 2, contract_signing: 2 };
const DEFAULT_DURATION: Partial<Record<SegmentKind, number>> = { match: 12, promo: 6, interview: 4, backstage: 3, confrontation: 7 };
const SIDE_NAMES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const EMPTY_SEGMENT: SegmentPayload = {
  kind: "match",
  title: "",
  custom_kind_label: "",
  description: "",
  duration_min: 12,
  storyline_id: null,
  match_type: "singles",
  stipulation: "standard",
  championship_id: null,
  stakes: "",
  finish_plan: "auto",
  predetermined_winner_side: null,
  title_changes_on_dq: false,
  interference: [],
  sides: [
    { team_id: null, members: [] },
    { team_id: null, members: [] },
  ],
};

export function SegmentEditor({ universeId, showId, segmentId, initial, options }: { universeId: string; showId: string; segmentId?: string; initial: SegmentPayload; options: EditorOptions }) {
  const [state, action] = useActionState(saveSegmentAction, {} as ActionState);
  const [seg, setSeg] = useState<SegmentPayload>(initial);
  const isMatch = seg.kind === "match";
  const byId = useMemo(() => new Map(options.wrestlers.map((w) => [w.id, w])), [options.wrestlers]);
  const used = new Set(seg.sides.flatMap((s) => s.members.map((m) => m.wrestler_id)));
  const set = (patch: Partial<SegmentPayload>) => setSeg((s) => ({ ...s, ...patch }));
  const setSide = (index: number, side: Side) => set({ sides: seg.sides.map((s, i) => (i === index ? side : s)) });

  function changeKind(kind: SegmentKind) {
    const sideCount = kind === "match" ? 2 : (NON_MATCH_SIDES[kind] ?? 1);
    const sides = [...seg.sides];
    while (sides.length < sideCount) sides.push({ team_id: null, members: [] });
    const trimmed = (kind === "match" ? sides : sides.filter((s, i) => i < sideCount || s.members.length > 0)).map((side) => ({
      ...side,
      members: side.members.map((m) => ({
        ...m,
        role: kind === "match" ? (m.role === "participant" ? ("competitor" as const) : m.role) : m.role === "competitor" ? ("participant" as const) : m.role,
      })),
    }));
    set({
      kind,
      sides: trimmed,
      match_type: kind === "match" ? (seg.match_type ?? "singles") : null,
      stipulation: kind === "match" ? (seg.stipulation ?? "standard") : null,
      finish_plan: kind === "match" ? (seg.finish_plan ?? "auto") : null,
      duration_min: seg.duration_min === (DEFAULT_DURATION[seg.kind] ?? 5) ? (DEFAULT_DURATION[kind] ?? 5) : seg.duration_min,
    });
  }

  function changeMatchType(type: MatchType) {
    const [count] = SHAPE[type] ?? [2, 1];
    const sides = [...seg.sides];
    while (sides.length < count) sides.push({ team_id: null, members: [] });
    set({ match_type: type, sides });
  }

  function applyTeam(index: number, teamId: string) {
    const team = options.teams.find((t) => t.id === teamId);
    if (!team) return setSide(index, { ...seg.sides[index], team_id: null });
    const members = team.memberIds.filter((id) => !used.has(id) || seg.sides[index].members.some((m) => m.wrestler_id === id)).map((id) => ({ wrestler_id: id, role: "competitor" as const }));
    setSide(index, { team_id: team.id, members });
  }

  function applyChampionship(id: string) {
    const c = options.championships.find((x) => x.id === id);
    if (!c) return set({ championship_id: null });
    const patch: Partial<SegmentPayload> = { championship_id: c.id };
    // Put the champions on side A when they're not booked yet.
    if (c.holderIds.length && !c.holderIds.some((h) => used.has(h))) {
      const sides = [...seg.sides];
      sides[0] = { team_id: null, members: [...c.holderIds.map((h) => ({ wrestler_id: h, role: "competitor" as const })), ...sides[0].members.filter((m) => m.role === "manager")] };
      patch.sides = sides;
      if (c.format === "tag" && seg.match_type === "singles") patch.match_type = "tag";
      if (c.format === "trios" && seg.match_type === "singles") patch.match_type = "trios";
    }
    set(patch);
  }

  const warnings: string[] = [];
  for (const id of used) {
    const w = byId.get(id);
    if (!w) continue;
    if (w.injured) warnings.push(`${w.name} is injured (${w.injured}).`);
    if (w.fatigue >= options.fatigueWarn) warnings.push(`${w.name} is fatigued (${w.fatigue}).`);
    if (!w.signed) warnings.push(`${w.name} isn't signed to this promotion.`);
  }
  if (isMatch && seg.championship_id) {
    const c = options.championships.find((x) => x.id === seg.championship_id);
    if (c && c.holderIds.length && !c.holderIds.some((h) => used.has(h))) warnings.push(`The current ${c.name} holder isn't in this match.`);
  }

  const sideLabel = (i: number) => {
    const names = seg.sides[i]?.members.filter((m) => m.role !== "manager").map((m) => byId.get(m.wrestler_id)?.name).filter(Boolean);
    return names?.length ? names.join(" & ") : `Side ${SIDE_NAMES[i]}`;
  };

  const payload = JSON.stringify({ ...seg, sides: seg.sides.map((s) => ({ ...s, members: s.members.filter((m) => m.wrestler_id) })) });
  const sorted = [...options.wrestlers].sort((a, b) => Number(b.signed) - Number(a.signed) || a.name.localeCompare(b.name));
  const wrestlerOptions = (current: string) => (
    <>
      <option value="" disabled>Choose wrestler…</option>
      <optgroup label="This promotion">
        {sorted.filter((w) => w.signed).map((w) => (
          <option key={w.id} value={w.id} disabled={used.has(w.id) && w.id !== current}>
            {w.name}{w.injured ? " (injured)" : ""}{w.role === "manager" ? " (manager)" : ""}
          </option>
        ))}
      </optgroup>
      <optgroup label="Others (guest appearance)">
        {sorted.filter((w) => !w.signed).map((w) => (
          <option key={w.id} value={w.id} disabled={used.has(w.id) && w.id !== current}>{w.name} · {w.promotion}</option>
        ))}
      </optgroup>
    </>
  );

  return (
    <form action={action} className="space-y-5" data-testid="segment-editor">
      <input type="hidden" name="universeId" value={universeId} />
      <input type="hidden" name="showId" value={showId} />
      {segmentId && <input type="hidden" name="segmentId" value={segmentId} />}
      <input type="hidden" name="payload" value={payload} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Segment type" htmlFor="kind">
          <Select id="kind" value={seg.kind} onChange={(e) => changeKind(e.target.value as SegmentKind)}>
            {SEGMENT_KINDS.map((k) => <option key={k} value={k}>{SEGMENT_KIND_LABELS[k]}</option>)}
          </Select>
        </Field>
        {seg.kind === "custom" && (
          <Field label="Custom label" htmlFor="custom_kind_label"><Input id="custom_kind_label" value={seg.custom_kind_label} maxLength={40} onChange={(e) => set({ custom_kind_label: e.target.value })} /></Field>
        )}
        <Field label="Length (minutes)" htmlFor="duration_min">
          <Input id="duration_min" type="number" min={1} max={120} value={seg.duration_min} onChange={(e) => set({ duration_min: Math.max(1, Math.min(120, Number(e.target.value) || 1)) })} />
        </Field>
        <Field label="Title (optional)" htmlFor="seg-title" className={seg.kind === "custom" ? "" : "sm:col-span-1"}>
          <Input id="seg-title" value={seg.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} placeholder={isMatch ? "e.g. No Way Out" : "e.g. The contract is signed"} />
        </Field>
      </div>

      {isMatch && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Match type" htmlFor="match_type">
            <Select id="match_type" value={seg.match_type ?? "singles"} onChange={(e) => changeMatchType(e.target.value as MatchType)}>
              {MATCH_TYPES.map((t) => <option key={t} value={t}>{MATCH_TYPE_LABELS[t]}</option>)}
            </Select>
          </Field>
          <Field label="Rules / stipulation" htmlFor="stipulation">
            <Select id="stipulation" value={seg.stipulation ?? "standard"} onChange={(e) => set({ stipulation: e.target.value as SegmentPayload["stipulation"] })}>
              {STIPULATIONS.map((s) => <option key={s} value={s}>{STIPULATION_LABELS[s]}</option>)}
            </Select>
          </Field>
          <Field label="Championship" htmlFor="championship_id">
            <Select id="championship_id" value={seg.championship_id ?? ""} onChange={(e) => applyChampionship(e.target.value)}>
              <option value="">Non-title match</option>
              {options.championships.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>
      )}

      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-semibold">{isMatch ? "Competitors" : "Participants"}</legend>
        {seg.sides.map((side, i) => (
          <div key={i} className="rounded-xl border border-border p-3" data-testid={`side-${i}`}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">{isMatch || seg.sides.length > 1 ? `Side ${SIDE_NAMES[i]}` : "Group"}</span>
              {options.teams.length > 0 && (
                <Select aria-label={`Team for side ${SIDE_NAMES[i]}`} value={side.team_id ?? ""} onChange={(e) => applyTeam(i, e.target.value)} className="h-9 w-auto flex-1 text-xs sm:max-w-56">
                  <option value="">No team</option>
                  {options.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              )}
              {seg.sides.length > 1 && (
                <button type="button" className="ml-auto text-xs text-muted hover:text-danger" onClick={() => set({ sides: seg.sides.filter((_, k) => k !== i), predetermined_winner_side: null, interference: seg.interference.filter((x) => x.favorsSide !== i) })}>
                  Remove side
                </button>
              )}
            </div>
            <ul className="space-y-2">
              {side.members.map((m, k) => (
                <li key={k} className="flex items-center gap-2">
                  <Select aria-label={`Side ${SIDE_NAMES[i]} wrestler ${k + 1}`} value={m.wrestler_id} onChange={(e) => setSide(i, { ...side, members: side.members.map((x, j) => (j === k ? { ...x, wrestler_id: e.target.value } : x)) })} className="flex-1">
                    {wrestlerOptions(m.wrestler_id)}
                  </Select>
                  {isMatch && (
                    <Select aria-label="Role" value={m.role} onChange={(e) => setSide(i, { ...side, members: side.members.map((x, j) => (j === k ? { ...x, role: e.target.value as typeof m.role } : x)) })} className="w-32 text-xs">
                      <option value="competitor">Competitor</option>
                      <option value="manager">In corner</option>
                    </Select>
                  )}
                  <button type="button" aria-label="Remove" className="h-11 w-9 shrink-0 rounded-lg text-muted hover:bg-surface-2 hover:text-danger" onClick={() => setSide(i, { ...side, members: side.members.filter((_, j) => j !== k) })}>✕</button>
                </li>
              ))}
            </ul>
            <Button type="button" variant="ghost" size="sm" className="mt-1" onClick={() => setSide(i, { ...side, members: [...side.members, { wrestler_id: "", role: isMatch ? "competitor" : "participant" }] })}>
              + Add {isMatch ? "wrestler" : "participant"}
            </Button>
          </div>
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={() => set({ sides: [...seg.sides, { team_id: null, members: [] }] })}>+ Add side</Button>
      </fieldset>

      {isMatch && (
        <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <legend className="mb-1 text-sm font-semibold">Finish</legend>
          <Field label="Planned winner" htmlFor="winner" hint="Leave on “Simulation decides” for a realistic, not always predictable result.">
            <Select id="winner" value={seg.predetermined_winner_side ?? ""} onChange={(e) => set({ predetermined_winner_side: e.target.value === "" ? null : Number(e.target.value) })}>
              <option value="">Simulation decides</option>
              {seg.sides.map((_, i) => <option key={i} value={i}>{sideLabel(i)}</option>)}
            </Select>
          </Field>
          <Field label="Finish style" htmlFor="finish_plan">
            <Select id="finish_plan" value={seg.finish_plan ?? "auto"} onChange={(e) => set({ finish_plan: e.target.value as SegmentPayload["finish_plan"] })}>
              {FINISH_PLANS.map((f) => <option key={f} value={f}>{FINISH_PLAN_LABELS[f]}</option>)}
            </Select>
          </Field>
          {seg.championship_id && (
            <div className="sm:col-span-2">
              <Checkbox checked={seg.title_changes_on_dq} onChange={(e) => set({ title_changes_on_dq: e.target.checked })} label="Title can change hands on a DQ or count-out" hint="Off by default: champions keep the belt on a disqualification." />
            </div>
          )}
          <div className="space-y-2 sm:col-span-2">
            <p className="text-sm font-medium">Interference</p>
            {seg.interference.map((it, k) => (
              <div key={k} className="flex items-center gap-2">
                <Select aria-label="Interfering wrestler" value={it.wrestlerId} onChange={(e) => set({ interference: seg.interference.map((x, j) => (j === k ? { ...x, wrestlerId: e.target.value } : x)) })} className="flex-1">
                  <option value="" disabled>Who interferes…</option>
                  {sorted.filter((w) => !used.has(w.id)).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </Select>
                <Select aria-label="Helps" value={it.favorsSide} onChange={(e) => set({ interference: seg.interference.map((x, j) => (j === k ? { ...x, favorsSide: Number(e.target.value) } : x)) })} className="w-40 text-xs">
                  {seg.sides.map((_, i) => <option key={i} value={i}>helps {sideLabel(i)}</option>)}
                </Select>
                <button type="button" aria-label="Remove interference" className="h-11 w-9 rounded-lg text-muted hover:text-danger" onClick={() => set({ interference: seg.interference.filter((_, j) => j !== k) })}>✕</button>
              </div>
            ))}
            {seg.interference.length < 6 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => set({ interference: [...seg.interference, { wrestlerId: "", favorsSide: 0 }] })}>+ Add interference</Button>
            )}
          </div>
        </fieldset>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Storyline" htmlFor="storyline_id">
          <Select id="storyline_id" value={seg.storyline_id ?? ""} onChange={(e) => set({ storyline_id: e.target.value || null })}>
            <option value="">None</option>
            {options.storylines.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </Select>
        </Field>
        <Field label="Stakes" htmlFor="stakes"><Input id="stakes" value={seg.stakes} maxLength={200} onChange={(e) => set({ stakes: e.target.value })} placeholder="e.g. Loser leaves town" /></Field>
        <Field label="Notes / description" htmlFor="description" className="sm:col-span-2"><Textarea id="description" value={seg.description} maxLength={2000} onChange={(e) => set({ description: e.target.value })} /></Field>
      </div>

      {warnings.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-gold/30 bg-gold-soft px-3 py-2 text-sm text-gold" aria-label="Warnings">
          {[...new Set(warnings)].map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}
      <FormMessage state={state} />
      <div className={cx("flex flex-wrap gap-2")}>
        <SubmitButton pendingLabel="Saving…">{segmentId ? "Save segment" : "Add to card"}</SubmitButton>
      </div>
    </form>
  );
}
