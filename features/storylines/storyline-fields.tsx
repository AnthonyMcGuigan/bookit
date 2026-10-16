import type { Championship, Promotion, Storyline } from "@/lib/domain/entities";
import { STORYLINE_KIND_LABELS, STORYLINE_KINDS } from "@/lib/domain/enums";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui";

export function StorylineFields({ storyline: s, promotions, championships }: { storyline?: Storyline; promotions: Promotion[]; championships: Championship[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Title" htmlFor="sl-title" className="sm:col-span-2"><Input id="sl-title" name="title" required maxLength={100} defaultValue={s?.title} /></Field>
      <Field label="Type" htmlFor="sl-kind">
        <Select id="sl-kind" name="kind" defaultValue={s?.kind ?? "rivalry"}>{STORYLINE_KINDS.map((k) => <option key={k} value={k}>{STORYLINE_KIND_LABELS[k]}</option>)}</Select>
      </Field>
      <Field label="Promotion" htmlFor="sl-promo">
        <Select id="sl-promo" name="promotion_id" defaultValue={s?.promotion_id ?? promotions[0]?.id ?? ""}>
          <option value="">Cross-promotion</option>
          {promotions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </Field>
      <Field label="Championship at stake" htmlFor="sl-champ">
        <Select id="sl-champ" name="championship_id" defaultValue={s?.championship_id ?? ""}>
          <option value="">None</option>
          {championships.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </Field>
      <Field label="Intensity (0–100)" htmlFor="sl-int" hint="Hotter stories add stakes and crowd interest."><Input id="sl-int" name="intensity" type="number" min={0} max={100} defaultValue={s?.intensity ?? 20} /></Field>
      <Field label="Objective" htmlFor="sl-obj" className="sm:col-span-2" hint="Where is this story going?"><Input id="sl-obj" name="objective" maxLength={500} defaultValue={s?.objective} /></Field>
      <Field label="Description" htmlFor="sl-desc" className="sm:col-span-2"><Textarea id="sl-desc" name="description" maxLength={4000} defaultValue={s?.description} /></Field>
      <div className="sm:col-span-2">
        <Checkbox name="auto_progress" defaultChecked={s?.auto_progress ?? true} label="Progress automatically" hint="Segments tied to the story raise intensity; it cools off when ignored and resolves when a title pursuit pays off." />
      </div>
    </div>
  );
}
