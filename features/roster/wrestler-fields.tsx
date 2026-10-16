import type { Promotion, Wrestler } from "@/lib/domain/entities";
import { ATTRIBUTE_GROUPS, ATTRIBUTE_LABELS } from "@/lib/domain/entities";
import {
  ALIGNMENT_LABELS,
  ALIGNMENTS,
  CARD_POSITION_LABELS,
  CARD_POSITIONS,
  CAREER_STATUS_LABELS,
  CAREER_STATUSES,
  DIVISION_LABELS,
  DIVISIONS,
  GENDER_LABELS,
  GENDERS,
  WRESTLER_ROLE_LABELS,
  WRESTLER_ROLES,
} from "@/lib/domain/enums";
import { Field, Input, Select, Textarea } from "@/components/ui";

const DEFAULTS = {
  ring_name: "", alternate_name: "", real_name: "", gender: "male", division: "mens", billed_from: "", height_cm: null, weight_kg: null,
  birth_date: null, debut_date: null, biography: "", finisher: "", career_status: "active", alignment: "face", role: "wrestler", card_position: "midcard",
  in_ring: 55, technical: 55, power: 55, speed: 55, stamina: 60, charisma: 50, mic_skills: 50, selling: 55, psychology: 50, reliability: 70, big_match: 50,
  popularity: 30, reputation: 40, morale: 70, momentum: 0,
} satisfies Partial<Record<keyof Wrestler, unknown>>;

export function WrestlerFields({ wrestler }: { wrestler?: Wrestler }) {
  const v = (wrestler ?? DEFAULTS) as typeof DEFAULTS & Partial<Wrestler>;
  return (
    <div className="space-y-6">
      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">Identity</legend>
        <Field label="Ring name" htmlFor="ring_name"><Input id="ring_name" name="ring_name" required maxLength={60} defaultValue={v.ring_name} /></Field>
        <Field label="Alternate name / nickname" htmlFor="alternate_name"><Input id="alternate_name" name="alternate_name" maxLength={60} defaultValue={v.alternate_name} /></Field>
        <Field label="Real name" htmlFor="real_name" hint="Optional, fictional characters only."><Input id="real_name" name="real_name" maxLength={80} defaultValue={v.real_name} /></Field>
        <Field label="Billed from" htmlFor="billed_from"><Input id="billed_from" name="billed_from" maxLength={80} defaultValue={v.billed_from} /></Field>
        <Field label="Gender" htmlFor="gender">
          <Select id="gender" name="gender" defaultValue={v.gender}>{GENDERS.map((g) => <option key={g} value={g}>{GENDER_LABELS[g]}</option>)}</Select>
        </Field>
        <Field label="Division" htmlFor="division">
          <Select id="division" name="division" defaultValue={v.division}>{DIVISIONS.map((d) => <option key={d} value={d}>{DIVISION_LABELS[d]}</option>)}</Select>
        </Field>
        <Field label="Height (cm)" htmlFor="height_cm"><Input id="height_cm" name="height_cm" type="number" inputMode="numeric" min={120} max={250} defaultValue={v.height_cm ?? ""} /></Field>
        <Field label="Weight (kg)" htmlFor="weight_kg"><Input id="weight_kg" name="weight_kg" type="number" inputMode="numeric" min={40} max={250} defaultValue={v.weight_kg ?? ""} /></Field>
        <Field label="Birth date" htmlFor="birth_date"><Input id="birth_date" name="birth_date" type="date" defaultValue={v.birth_date ?? ""} /></Field>
        <Field label="Debut date" htmlFor="debut_date"><Input id="debut_date" name="debut_date" type="date" defaultValue={v.debut_date ?? ""} /></Field>
        <Field label="Finisher" htmlFor="finisher"><Input id="finisher" name="finisher" maxLength={60} defaultValue={v.finisher} /></Field>
        <Field label="Biography" htmlFor="biography" className="sm:col-span-2"><Textarea id="biography" name="biography" maxLength={4000} defaultValue={v.biography} /></Field>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">Character & status</legend>
        <Field label="Alignment" htmlFor="alignment">
          <Select id="alignment" name="alignment" defaultValue={v.alignment}>{ALIGNMENTS.map((a) => <option key={a} value={a}>{ALIGNMENT_LABELS[a]}</option>)}</Select>
        </Field>
        <Field label="Role" htmlFor="role">
          <Select id="role" name="role" defaultValue={v.role}>{WRESTLER_ROLES.map((r) => <option key={r} value={r}>{WRESTLER_ROLE_LABELS[r]}</option>)}</Select>
        </Field>
        <Field label="Card position" htmlFor="card_position">
          <Select id="card_position" name="card_position" defaultValue={v.card_position}>{CARD_POSITIONS.map((c) => <option key={c} value={c}>{CARD_POSITION_LABELS[c]}</option>)}</Select>
        </Field>
        <Field label="Career status" htmlFor="career_status">
          <Select id="career_status" name="career_status" defaultValue={v.career_status}>{CAREER_STATUSES.map((c) => <option key={c} value={c}>{CAREER_STATUS_LABELS[c]}</option>)}</Select>
        </Field>
      </fieldset>

      {ATTRIBUTE_GROUPS.map((group) => (
        <fieldset key={group.label} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <legend className="mb-2 text-sm font-semibold">{group.label} attributes <span className="font-normal text-muted">(0–100)</span></legend>
          {group.keys.map((k) => (
            <Field key={k} label={ATTRIBUTE_LABELS[k]} htmlFor={k}>
              <Input id={k} name={k} type="number" inputMode="numeric" min={0} max={100} required defaultValue={v[k]} />
            </Field>
          ))}
        </fieldset>
      ))}

      <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <legend className="mb-2 text-sm font-semibold">Standing</legend>
        <Field label="Popularity" htmlFor="popularity"><Input id="popularity" name="popularity" type="number" inputMode="numeric" min={0} max={100} required defaultValue={v.popularity} /></Field>
        <Field label="Reputation" htmlFor="reputation"><Input id="reputation" name="reputation" type="number" inputMode="numeric" min={0} max={100} required defaultValue={v.reputation} /></Field>
        <Field label="Morale" htmlFor="morale"><Input id="morale" name="morale" type="number" inputMode="numeric" min={0} max={100} required defaultValue={v.morale} /></Field>
        <Field label="Momentum" htmlFor="momentum" hint="−100 to 100"><Input id="momentum" name="momentum" type="number" inputMode="numeric" min={-100} max={100} required defaultValue={v.momentum} /></Field>
      </fieldset>
    </div>
  );
}

export function ContractFields({ promotions, optional = false, defaultPromotionId, financesEnabled }: { promotions: Promotion[]; optional?: boolean; defaultPromotionId?: string; financesEnabled: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Promotion" htmlFor="promotion_id">
        <Select id="promotion_id" name="promotion_id" defaultValue={defaultPromotionId ?? (optional ? "" : promotions[0]?.id)} required={!optional}>
          {optional && <option value="">Free agent (don’t sign yet)</option>}
          {promotions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </Field>
      <Field label="Length (months)" htmlFor="months"><Input id="months" name="months" type="number" inputMode="numeric" min={1} max={60} defaultValue={12} /></Field>
      <Field label="Weekly salary" htmlFor="weekly_salary" hint={financesEnabled ? undefined : "Finances are off; stored for reference."}>
        <Input id="weekly_salary" name="weekly_salary" type="number" inputMode="numeric" min={0} defaultValue={2000} />
      </Field>
      <Field label="Appearance fee" htmlFor="appearance_fee"><Input id="appearance_fee" name="appearance_fee" type="number" inputMode="numeric" min={0} defaultValue={0} /></Field>
    </div>
  );
}
