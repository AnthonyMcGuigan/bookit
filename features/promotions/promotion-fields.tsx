import type { Promotion } from "@/lib/domain/entities";
import { AUDIENCE_PROFILE_LABELS, AUDIENCE_PROFILES } from "@/lib/domain/enums";
import { Field, Input, Select, Textarea } from "@/components/ui";

export function PromotionFields({ promotion }: { promotion?: Promotion }) {
  const p = promotion;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Name" htmlFor="name"><Input id="name" name="name" required maxLength={80} defaultValue={p?.name} /></Field>
      <Field label="Abbreviation" htmlFor="abbreviation"><Input id="abbreviation" name="abbreviation" required maxLength={8} defaultValue={p?.abbreviation} /></Field>
      <Field label="Tagline" htmlFor="tagline" className="sm:col-span-2"><Input id="tagline" name="tagline" maxLength={120} defaultValue={p?.tagline} /></Field>
      <Field label="Region" htmlFor="region"><Input id="region" name="region" maxLength={60} defaultValue={p?.region ?? "National"} /></Field>
      <Field label="Audience" htmlFor="audience_profile" hint="Changes what fans reward.">
        <Select id="audience_profile" name="audience_profile" defaultValue={p?.audience_profile ?? "mainstream"}>
          {AUDIENCE_PROFILES.map((a) => <option key={a} value={a}>{AUDIENCE_PROFILE_LABELS[a]}</option>)}
        </Select>
      </Field>
      <Field label="Primary color" htmlFor="primary_color"><Input id="primary_color" name="primary_color" type="color" className="h-11 p-1" defaultValue={p?.primary_color ?? "#b91c1c"} /></Field>
      <Field label="Secondary color" htmlFor="secondary_color"><Input id="secondary_color" name="secondary_color" type="color" className="h-11 p-1" defaultValue={p?.secondary_color ?? "#111827"} /></Field>
      <Field label="Reputation (0–100)" htmlFor="reputation"><Input id="reputation" name="reputation" type="number" min={0} max={100} required defaultValue={p?.reputation ?? 30} /></Field>
      <Field label="Popularity (0–100)" htmlFor="popularity"><Input id="popularity" name="popularity" type="number" min={0} max={100} required defaultValue={p?.popularity ?? 25} /></Field>
      <Field label="Controlled by" htmlFor="controlled_by" hint="AI promotions run their own shows and sign free agents.">
        <Select id="controlled_by" name="controlled_by" defaultValue={p?.controlled_by ?? "player"}>
          <option value="player">You</option>
          <option value="ai">AI rival</option>
        </Select>
      </Field>
      <Field label="Founded" htmlFor="founded_on"><Input id="founded_on" name="founded_on" type="date" defaultValue={p?.founded_on ?? ""} /></Field>
      <Field label="Description" htmlFor="description" className="sm:col-span-2"><Textarea id="description" name="description" maxLength={4000} defaultValue={p?.description} /></Field>
    </div>
  );
}
