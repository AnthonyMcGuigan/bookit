import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getUniverseState } from "@/lib/game/load";
import { Card, PageHeader } from "@/components/ui";
import { EMPTY_SEGMENT, SegmentEditor } from "@/features/booking/segment-editor";
import { editorOptions } from "@/features/booking/editor-options";

export const metadata: Metadata = { title: "Add segment" };

export default async function NewSegmentPage({ params }: { params: Promise<{ universeId: string; showId: string }> }) {
  const { universeId, showId } = await params;
  const state = await getUniverseState(universeId);
  const show = state.shows.find((s) => s.id === showId);
  if (!show) notFound();
  if (show.status === "completed") redirect(`/u/${universeId}/booking/${showId}`);
  return (
    <>
      <PageHeader title="Add segment" subtitle={show.name} back={{ href: `/u/${universeId}/booking/${showId}`, label: show.name }} />
      <Card className="p-4">
        <SegmentEditor universeId={universeId} showId={showId} initial={EMPTY_SEGMENT} options={editorOptions(state, show)} />
      </Card>
    </>
  );
}
