import type { Metadata } from "next";
import { getUniverseState } from "@/lib/game/load";
import { formatGameDate } from "@/lib/domain/dates";
import { Card, CardHeader, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { deleteUniverseAction, updateUniverseSettingsAction } from "@/features/universes/actions";
import { SettingsFields } from "@/features/universes/settings-fields";

export const metadata: Metadata = { title: "Universe settings" };

export default async function SettingsPage({ params }: { params: Promise<{ universeId: string }> }) {
  const { universeId } = await params;
  const state = await getUniverseState(universeId);
  const u = state.universe;
  return (
    <>
      <PageHeader title="Universe settings" subtitle={`Started ${formatGameDate(u.start_date)} · ${u.origin.replace("_", " ")} · save revision ${u.revision}`} back={{ href: `/u/${universeId}/more`, label: "More" }} />
      <Card className="mb-6">
        <CardHeader title="General and rules" subtitle="Changes apply to future simulations; past results stay as they were." />
        <div className="p-4">
          <ActionForm action={updateUniverseSettingsAction} submitLabel="Save settings">
            <input type="hidden" name="universeId" value={universeId} />
            <Field label="Universe name" htmlFor="name"><Input id="name" name="name" required maxLength={80} defaultValue={u.name} /></Field>
            <Field label="Description" htmlFor="description"><Textarea id="description" name="description" maxLength={2000} defaultValue={u.description} /></Field>
            <SettingsFields settings={u.settings} detailed />
          </ActionForm>
        </div>
      </Card>
      <Card>
        <CardHeader title="Delete universe" subtitle="Permanently removes this save and everything in it. Export a backup first if you might want it back." />
        <div className="p-4">
          <ActionForm action={deleteUniverseAction} submitLabel="Delete forever" submitVariant="danger" confirm="Delete this universe permanently?">
            <input type="hidden" name="universeId" value={universeId} />
            <Field label={`Type "${u.name}" to confirm`} htmlFor="confirmName"><Input id="confirmName" name="confirmName" autoComplete="off" /></Field>
          </ActionForm>
        </div>
      </Card>
    </>
  );
}
