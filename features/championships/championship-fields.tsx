import type { Championship, Promotion } from "@/lib/domain/entities";
import {
  CARD_POSITION_LABELS,
  CARD_POSITIONS,
  CHAMPIONSHIP_FORMAT_LABELS,
  CHAMPIONSHIP_FORMATS,
  CHAMPIONSHIP_TIER_LABELS,
  CHAMPIONSHIP_TIERS,
  DIVISION_LABELS,
  DIVISIONS,
} from "@/lib/domain/enums";
import { Field, Input, Select, Textarea } from "@/components/ui";

export function ChampionshipFields({ championship: c, promotions }: { championship?: Championship; promotions: Promotion[] }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name"><Input id="name" name="name" required maxLength={80} defaultValue={c?.name} placeholder="e.g. Ironside Heavyweight Championship" /></Field>
        <Field label="Promotion" htmlFor="promotion_id">
          <Select id="promotion_id" name="promotion_id" defaultValue={c?.promotion_id ?? promotions[0]?.id}>{promotions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        </Field>
        <Field label="Format" htmlFor="format">
          <Select id="format" name="format" defaultValue={c?.format ?? "singles"}>{CHAMPIONSHIP_FORMATS.map((f) => <option key={f} value={f}>{CHAMPIONSHIP_FORMAT_LABELS[f]}</option>)}</Select>
        </Field>
        <Field label="Division" htmlFor="division">
          <Select id="division" name="division" defaultValue={c?.division ?? "mens"}>{DIVISIONS.map((d) => <option key={d} value={d}>{DIVISION_LABELS[d]}</option>)}</Select>
        </Field>
        <Field label="Tier" htmlFor="tier">
          <Select id="tier" name="tier" defaultValue={c?.tier ?? "secondary"}>{CHAMPIONSHIP_TIERS.map((t) => <option key={t} value={t}>{CHAMPIONSHIP_TIER_LABELS[t]}</option>)}</Select>
        </Field>
        <Field label="Prestige (0–100)" htmlFor="prestige" hint="Raises the stakes and crowd interest in title matches.">
          <Input id="prestige" name="prestige" type="number" min={0} max={100} required defaultValue={c?.prestige ?? 50} />
        </Field>
        <Field label="Established" htmlFor="established_on"><Input id="established_on" name="established_on" type="date" defaultValue={c?.established_on ?? ""} /></Field>
        <Field label="Display order" htmlFor="sort_order"><Input id="sort_order" name="sort_order" type="number" min={0} max={999} defaultValue={c?.sort_order ?? 0} /></Field>
        <Field label="Description" htmlFor="description" className="sm:col-span-2"><Textarea id="description" name="description" maxLength={2000} defaultValue={c?.description} /></Field>
      </div>
      <fieldset>
        <legend className="mb-1 text-sm font-semibold">Eligibility</legend>
        <p className="mb-2 text-xs text-muted">Used for booking warnings only; you can always override.</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {DIVISIONS.map((d) => (
            <label key={d} className="flex items-center gap-2 text-sm"><input type="checkbox" name="elig_divisions" value={d} defaultChecked={c?.eligibility.divisions?.includes(d)} className="h-4 w-4 accent-[var(--accent)]" />{DIVISION_LABELS[d]}</label>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {CARD_POSITIONS.map((p) => (
            <label key={p} className="flex items-center gap-2 text-sm"><input type="checkbox" name="elig_positions" value={p} defaultChecked={c?.eligibility.cardPositions?.includes(p)} className="h-4 w-4 accent-[var(--accent)]" />{CARD_POSITION_LABELS[p]}</label>
          ))}
        </div>
        <Field label="Notes" htmlFor="eligibility_notes" className="mt-2"><Input id="eligibility_notes" name="eligibility_notes" maxLength={300} defaultValue={c?.eligibility.notes ?? ""} /></Field>
      </fieldset>
    </div>
  );
}
