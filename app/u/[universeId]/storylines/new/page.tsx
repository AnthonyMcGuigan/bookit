import type { Metadata } from "next";
import { getUniverseState } from "@/lib/game/load";
import { Card, Field, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { saveStorylineAction } from "@/features/storylines/actions";
import { StorylineFields } from "@/features/storylines/storyline-fields";

export const metadata: Metadata = { title: "New storyline" };

export default async function NewStorylinePage({ params }: { params: Promise<{ universeId: string }> }) {
  const { universeId } = await params;
  const state = await getUniverseState(universeId);
  const wrestlers = state.wrestlers.filter((w) => !w.archived_at && w.career_status !== "retired").sort((a, b) => a.ring_name.localeCompare(b.ring_name));
  const picker = (name: string, label: string, hint: string) => (
    <Field label={label} htmlFor={name} hint={hint}>
      <select id={name} name={name} multiple size={8} className="w-full rounded-lg border border-border bg-surface p-1 text-sm">
        {wrestlers.map((w) => <option key={w.id} value={w.id}>{w.ring_name}</option>)}
      </select>
    </Field>
  );
  return (
    <>
      <PageHeader title="New storyline" back={{ href: `/u/${universeId}/storylines`, label: "Storylines" }} />
      <Card className="p-4">
        <ActionForm action={saveStorylineAction} submitLabel="Start storyline">
          <input type="hidden" name="universeId" value={universeId} />
          <StorylineFields promotions={state.promotions.filter((p) => !p.archived_at)} championships={state.championships.filter((c) => c.status === "active")} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {picker("side0", "Protagonists", "Hold Ctrl/⌘ to pick several on desktop.")}
            {picker("side1", "Antagonists", "Leave empty for a solo arc.")}
          </div>
        </ActionForm>
      </Card>
    </>
  );
}
