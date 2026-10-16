import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getUniverseState } from "@/lib/game/load";
import { Card, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { saveWrestlerAction } from "@/features/roster/actions";
import { WrestlerFields } from "@/features/roster/wrestler-fields";

export const metadata: Metadata = { title: "Edit wrestler" };

export default async function EditWrestlerPage({ params }: { params: Promise<{ universeId: string; wrestlerId: string }> }) {
  const { universeId, wrestlerId } = await params;
  const state = await getUniverseState(universeId);
  const wrestler = state.wrestlers.find((w) => w.id === wrestlerId);
  if (!wrestler) notFound();
  return (
    <>
      <PageHeader title={`Edit ${wrestler.ring_name}`} back={{ href: `/u/${universeId}/roster/${wrestlerId}`, label: wrestler.ring_name }} />
      <Card className="p-4">
        <ActionForm action={saveWrestlerAction} submitLabel="Save changes">
          <input type="hidden" name="universeId" value={universeId} />
          <input type="hidden" name="wrestlerId" value={wrestlerId} />
          <WrestlerFields wrestler={wrestler} />
        </ActionForm>
      </Card>
    </>
  );
}
