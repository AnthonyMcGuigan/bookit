import type { Promotion, Team } from "@/lib/domain/entities";
import { TEAM_KIND_LABELS, TEAM_KINDS } from "@/lib/domain/enums";
import { Field, Input, Select, Textarea } from "@/components/ui";

export function TeamFields({ team, promotions }: { team?: Team; promotions: Promotion[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Name" htmlFor="name"><Input id="name" name="name" required maxLength={80} defaultValue={team?.name} /></Field>
      <Field label="Type" htmlFor="kind">
        <Select id="kind" name="kind" defaultValue={team?.kind ?? "tag_team"}>{TEAM_KINDS.map((k) => <option key={k} value={k}>{TEAM_KIND_LABELS[k]}</option>)}</Select>
      </Field>
      <Field label="Promotion" htmlFor="promotion_id">
        <Select id="promotion_id" name="promotion_id" defaultValue={team?.promotion_id ?? promotions[0]?.id ?? ""}>
          <option value="">Independent</option>
          {promotions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </Field>
      <Field label="Experience together (0–100)" htmlFor="experience" hint="Grows as they team up; boosts tag match quality.">
        <Input id="experience" name="experience" type="number" min={0} max={100} defaultValue={team?.experience ?? 0} />
      </Field>
      {!team && <Field label="Formed on" htmlFor="formed_on"><Input id="formed_on" name="formed_on" type="date" /></Field>}
      <Field label="Description" htmlFor="description" className="sm:col-span-2"><Textarea id="description" name="description" maxLength={2000} defaultValue={team?.description} /></Field>
    </div>
  );
}
