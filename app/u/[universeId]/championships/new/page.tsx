import type { Metadata } from "next";
import { getUniverseState } from "@/lib/game/load";
import { Card, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { saveChampionshipAction } from "@/features/championships/actions";
import { ChampionshipFields } from "@/features/championships/championship-fields";

export const metadata: Metadata = { title: "New championship" };

export default async function NewChampionshipPage({ params }: { params: Promise<{ universeId: string }> }) {
  const { universeId } = await params;
  const state = await getUniverseState(universeId);
  const promotions = state.promotions.filter((p) => !p.archived_at);
  const candidates = state.wrestlers.filter((w) => !w.archived_at && w.career_status === "active").sort((a, b) => a.ring_name.localeCompare(b.ring_name));
  return (
    <>
      <PageHeader title="New championship" back={{ href: `/u/${universeId}/championships`, label: "Championships" }} />
      <Card className="p-4">
        <ActionForm action={saveChampionshipAction} submitLabel="Create championship">
          <input type="hidden" name="universeId" value={universeId} />
          <ChampionshipFields promotions={promotions} />
          <details>
            <summary className="cursor-pointer text-sm font-medium">Name an inaugural champion (optional)</summary>
            <p className="my-2 text-xs text-muted">Pick 1 for singles, 2 for tag, 3 for trios. Leave empty to crown a champion in the ring.</p>
            <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {candidates.map((w) => (
                <li key={w.id}><label className="flex items-center gap-3 px-3 py-2 text-sm"><input type="checkbox" name="holders" value={w.id} className="h-5 w-5 accent-[var(--accent)]" />{w.ring_name}</label></li>
              ))}
            </ul>
          </details>
        </ActionForm>
      </Card>
    </>
  );
}
