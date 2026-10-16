import type { Metadata } from "next";
import { getUniverseState } from "@/lib/game/load";
import type { Venue } from "@/lib/domain/entities";
import { Badge, Button, Card, CardHeader, Field, Input, PageHeader, formatMoney } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { saveVenueAction, setVenueArchivedAction } from "@/features/promotions/actions";

export const metadata: Metadata = { title: "Venues" };

function VenueFields({ v }: { v?: Venue }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Field label="Name" htmlFor={`name-${v?.id ?? "new"}`} className="sm:col-span-3"><Input id={`name-${v?.id ?? "new"}`} name="name" required maxLength={80} defaultValue={v?.name} /></Field>
      <Field label="City" htmlFor={`city-${v?.id ?? "new"}`}><Input id={`city-${v?.id ?? "new"}`} name="city" maxLength={80} defaultValue={v?.city} /></Field>
      <Field label="Region" htmlFor={`region-${v?.id ?? "new"}`}><Input id={`region-${v?.id ?? "new"}`} name="region" maxLength={60} defaultValue={v?.region} /></Field>
      <Field label="Capacity" htmlFor={`cap-${v?.id ?? "new"}`}><Input id={`cap-${v?.id ?? "new"}`} name="capacity" type="number" min={50} max={150000} required defaultValue={v?.capacity ?? 2500} /></Field>
      <Field label="Rental cost" htmlFor={`cost-${v?.id ?? "new"}`}><Input id={`cost-${v?.id ?? "new"}`} name="rental_cost" type="number" min={0} required defaultValue={v?.rental_cost ?? 8000} /></Field>
      <Field label="Prestige (0–100)" htmlFor={`pres-${v?.id ?? "new"}`}><Input id={`pres-${v?.id ?? "new"}`} name="prestige" type="number" min={0} max={100} required defaultValue={v?.prestige ?? 40} /></Field>
    </div>
  );
}

export default async function VenuesPage({ params }: { params: Promise<{ universeId: string }> }) {
  const { universeId } = await params;
  const state = await getUniverseState(universeId);
  const currency = state.universe.settings.currency;
  return (
    <>
      <PageHeader title="Venues" subtitle="Bigger, more prestigious buildings raise attendance ceilings and production value." back={{ href: `/u/${universeId}/more`, label: "More" }} />
      <ul className="space-y-3">
        {state.venues.map((v) => (
          <li key={v.id}>
            <Card>
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-3">
                  <span className="font-semibold">{v.name}</span>
                  {v.archived_at && <Badge>Archived</Badge>}
                  <span className="text-xs text-muted">{[v.city, v.region].filter(Boolean).join(", ")} · {v.capacity.toLocaleString("en-US")} seats · {formatMoney(v.rental_cost, currency)} · prestige {v.prestige}</span>
                </summary>
                <div className="space-y-3 border-t border-border p-4">
                  <ActionForm action={saveVenueAction} submitLabel="Save venue" submitSize="sm">
                    <input type="hidden" name="universeId" value={universeId} />
                    <input type="hidden" name="venueId" value={v.id} />
                    <VenueFields v={v} />
                  </ActionForm>
                  <form action={setVenueArchivedAction}>
                    <input type="hidden" name="universeId" value={universeId} />
                    <input type="hidden" name="venueId" value={v.id} />
                    <input type="hidden" name="archive" value={v.archived_at ? "false" : "true"} />
                    <Button size="sm" variant="ghost">{v.archived_at ? "Restore" : "Archive"}</Button>
                  </form>
                </div>
              </details>
            </Card>
          </li>
        ))}
        {state.venues.length === 0 && <li className="text-sm text-muted">No venues yet. Shows without a venue use a generic hall with a modest capacity.</li>}
      </ul>
      <Card className="mt-6">
        <CardHeader title="Add a venue" />
        <div className="p-4">
          <ActionForm action={saveVenueAction} submitLabel="Add venue" resetOnSuccess>
            <input type="hidden" name="universeId" value={universeId} />
            <VenueFields />
          </ActionForm>
        </div>
      </Card>
    </>
  );
}
