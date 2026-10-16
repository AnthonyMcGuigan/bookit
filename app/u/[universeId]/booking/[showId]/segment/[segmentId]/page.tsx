import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getUniverseState } from "@/lib/game/load";
import { Card, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { SegmentEditor } from "@/features/booking/segment-editor";
import { editorOptions, payloadFromSegment } from "@/features/booking/editor-options";
import { deleteSegmentAction } from "@/features/booking/actions";

export const metadata: Metadata = { title: "Edit segment" };

export default async function EditSegmentPage({ params }: { params: Promise<{ universeId: string; showId: string; segmentId: string }> }) {
  const { universeId, showId, segmentId } = await params;
  const state = await getUniverseState(universeId);
  const show = state.shows.find((s) => s.id === showId);
  const segment = state.segments.find((s) => s.id === segmentId && s.show_id === showId);
  if (!show || !segment) notFound();
  if (show.status === "completed") redirect(`/u/${universeId}/booking/${showId}`);
  return (
    <>
      <PageHeader title="Edit segment" subtitle={show.name} back={{ href: `/u/${universeId}/booking/${showId}`, label: show.name }} />
      <Card className="p-4">
        <SegmentEditor universeId={universeId} showId={showId} segmentId={segmentId} initial={payloadFromSegment(state, segment)} options={editorOptions(state, show)} />
      </Card>
      <div className="mt-4">
        <ActionForm action={deleteSegmentAction} submitLabel="Delete segment" submitVariant="ghost" submitSize="sm" confirm="Remove this segment from the card?" redirectTo={`/u/${universeId}/booking/${showId}`}>
          <input type="hidden" name="universeId" value={universeId} />
          <input type="hidden" name="showId" value={showId} />
          <input type="hidden" name="segmentId" value={segmentId} />
        </ActionForm>
      </div>
    </>
  );
}
