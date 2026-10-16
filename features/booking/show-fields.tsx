import type { Promotion, Show, Venue } from "@/lib/domain/entities";
import { SHOW_TYPE_LABELS, SHOW_TYPES } from "@/lib/domain/enums";
import { Field, Input, Select, Textarea } from "@/components/ui";

export function ShowFields({ show, promotions, venues, minDate, defaultDate }: { show?: Show; promotions: Promotion[]; venues: Venue[]; minDate: string; defaultDate: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Show name" htmlFor="show-name" className="sm:col-span-2"><Input id="show-name" name="name" required maxLength={80} defaultValue={show?.name} placeholder="e.g. Ironside Uprising #321" /></Field>
      <Field label="Promotion" htmlFor="promotion_id">
        <Select id="promotion_id" name="promotion_id" defaultValue={show?.promotion_id ?? promotions[0]?.id}>{promotions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
      </Field>
      <Field label="Date" htmlFor="show_date"><Input id="show_date" name="show_date" type="date" required min={minDate} defaultValue={show?.show_date ?? defaultDate} /></Field>
      <Field label="Type" htmlFor="show_type">
        <Select id="show_type" name="show_type" defaultValue={show?.show_type ?? "weekly_tv"}>{SHOW_TYPES.map((t) => <option key={t} value={t}>{SHOW_TYPE_LABELS[t]}</option>)}</Select>
      </Field>
      <Field label="Custom type label" htmlFor="custom_type_label" hint="Only for custom shows."><Input id="custom_type_label" name="custom_type_label" maxLength={40} defaultValue={show?.custom_type_label} /></Field>
      <Field label="Venue" htmlFor="venue_id">
        <Select id="venue_id" name="venue_id" defaultValue={show?.venue_id ?? ""}>
          <option value="">Generic hall</option>
          {venues.filter((v) => !v.archived_at || v.id === show?.venue_id).map((v) => <option key={v.id} value={v.id}>{v.name} ({v.capacity.toLocaleString("en-US")})</option>)}
        </Select>
      </Field>
      <Field label="Target length (minutes)" htmlFor="target_duration_min"><Input id="target_duration_min" name="target_duration_min" type="number" min={15} max={600} required defaultValue={show?.target_duration_min ?? 120} /></Field>
      <Field label="Ticket price" htmlFor="ticket_price"><Input id="ticket_price" name="ticket_price" type="number" min={0} max={1000} required defaultValue={show?.ticket_price ?? 30} /></Field>
      <Field label="Notes" htmlFor="show-notes" className="sm:col-span-2"><Textarea id="show-notes" name="notes" maxLength={2000} defaultValue={show?.notes} /></Field>
    </div>
  );
}
