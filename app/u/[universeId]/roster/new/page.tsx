import type { Metadata } from "next";
import { getUniverseState } from "@/lib/game/load";
import { playerPromotions } from "@/lib/domain/selectors";
import { Card, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { saveWrestlerAction } from "@/features/roster/actions";
import { ContractFields, WrestlerFields } from "@/features/roster/wrestler-fields";

export const metadata: Metadata = { title: "New wrestler" };

export default async function NewWrestlerPage({ params }: { params: Promise<{ universeId: string }> }) {
  const { universeId } = await params;
  const state = await getUniverseState(universeId);
  const promotions = state.promotions.filter((p) => !p.archived_at);
  return (
    <>
      <PageHeader title="New wrestler" back={{ href: `/u/${universeId}/roster`, label: "Roster" }} />
      <Card className="p-4">
        <ActionForm action={saveWrestlerAction} submitLabel="Create wrestler" pendingLabel="Creating…">
          <input type="hidden" name="universeId" value={universeId} />
          <WrestlerFields />
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Contract</legend>
            <ContractFields promotions={promotions} optional defaultPromotionId={playerPromotions(state)[0]?.id} financesEnabled={state.universe.settings.financesEnabled} />
          </fieldset>
        </ActionForm>
      </Card>
    </>
  );
}
