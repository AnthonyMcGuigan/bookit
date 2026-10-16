import type { Metadata } from "next";
import { getUniverseState } from "@/lib/game/load";
import { indexById } from "@/lib/domain/selectors";
import { Card, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { saveTeamAction } from "@/features/teams/actions";
import { TeamFields } from "@/features/teams/team-fields";

export const metadata: Metadata = { title: "New team" };

export default async function NewTeamPage({ params }: { params: Promise<{ universeId: string }> }) {
  const { universeId } = await params;
  const state = await getUniverseState(universeId);
  const promotions = state.promotions.filter((p) => !p.archived_at);
  const promoById = indexById(state.promotions);
  const memberOf = new Map<string, string>();
  for (const m of state.rosterMemberships) if (m.ended_on === null) memberOf.set(m.wrestler_id, promoById.get(m.promotion_id)?.abbreviation ?? "");
  const candidates = state.wrestlers.filter((w) => !w.archived_at && w.career_status !== "retired").sort((a, b) => a.ring_name.localeCompare(b.ring_name));
  return (
    <>
      <PageHeader title="New team or faction" back={{ href: `/u/${universeId}/teams`, label: "Teams" }} />
      <Card className="p-4">
        <ActionForm action={saveTeamAction} submitLabel="Create team">
          <input type="hidden" name="universeId" value={universeId} />
          <TeamFields promotions={promotions} />
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Members</legend>
            <p className="mb-2 text-xs text-muted">Tag teams need 2, trios 3, factions 2 or more. Pick a leader with the radio button (optional).</p>
            <ul className="max-h-96 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {candidates.map((w) => (
                <li key={w.id} className="flex items-center gap-3 px-3 py-2">
                  <input type="checkbox" id={`m-${w.id}`} name="members" value={w.id} className="h-5 w-5 accent-[var(--accent)]" />
                  <label htmlFor={`m-${w.id}`} className="min-w-0 flex-1 truncate text-sm">{w.ring_name} <span className="text-xs text-muted">{memberOf.get(w.id) ?? "Free agent"}</span></label>
                  <label className="flex items-center gap-1 text-xs text-muted"><input type="radio" name="leader" value={w.id} className="accent-[var(--accent)]" /> Leader</label>
                </li>
              ))}
            </ul>
          </fieldset>
        </ActionForm>
      </Card>
    </>
  );
}
