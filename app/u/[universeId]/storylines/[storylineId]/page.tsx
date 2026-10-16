import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUniverseState } from "@/lib/game/load";
import { indexById } from "@/lib/domain/selectors";
import { STORYLINE_KIND_LABELS, STORYLINE_ROLES, STORYLINE_STATUS_LABELS, STORYLINE_STATUSES } from "@/lib/domain/enums";
import { formatGameDate } from "@/lib/domain/dates";
import { Badge, Button, Card, CardHeader, Field, Input, PageHeader, Select, Stat } from "@/components/ui";
import { WrestlerAvatar } from "@/components/artwork";
import { ActionForm } from "@/components/action-form";
import { addDevelopmentAction, addParticipantAction, removeParticipantAction, saveStorylineAction, setStorylineStatusAction } from "@/features/storylines/actions";
import { StorylineFields } from "@/features/storylines/storyline-fields";

export const metadata: Metadata = { title: "Storyline" };

export default async function StorylinePage({ params }: { params: Promise<{ universeId: string; storylineId: string }> }) {
  const { universeId, storylineId } = await params;
  const state = await getUniverseState(universeId, "full");
  const s = state.storylines.find((x) => x.id === storylineId);
  if (!s) notFound();
  const base = `/u/${universeId}`;
  const wrestlers = indexById(state.wrestlers);
  const shows = indexById(state.shows);
  const participants = state.storylineParticipants.filter((p) => p.storyline_id === s.id).sort((a, b) => a.side - b.side);
  const developments = state.storylineDevelopments.filter((d) => d.storyline_id === s.id).sort((a, b) => (a.occurred_on < b.occurred_on ? 1 : a.occurred_on > b.occurred_on ? -1 : 0));
  const segments = state.segments.filter((g) => g.storyline_id === s.id);
  const hidden = (
    <>
      <input type="hidden" name="universeId" value={universeId} />
      <input type="hidden" name="storylineId" value={s.id} />
    </>
  );
  return (
    <>
      <PageHeader back={{ href: `${base}/storylines`, label: "Storylines" }} title={s.title} subtitle={`${STORYLINE_KIND_LABELS[s.kind]} · started ${formatGameDate(s.started_on)}${s.resolved_on ? ` · ended ${formatGameDate(s.resolved_on)}` : ""}`} />
      <div className="mb-4 grid grid-cols-3 gap-2">
        <Stat label="Status" value={STORYLINE_STATUS_LABELS[s.status]} />
        <Stat label="Intensity" value={<span className="text-rivalry">{s.intensity}</span>} />
        <Stat label="Segments" value={segments.length} />
      </div>
      {s.objective && <p className="mb-4 text-sm"><span className="text-muted">Objective:</span> {s.objective}</p>}
      {s.resolution && <p className="mb-4 text-sm"><span className="text-muted">Resolution:</span> {s.resolution}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Cast" />
          <ul className="divide-y divide-border">
            {participants.map((p) => {
              const w = p.wrestler_id ? wrestlers.get(p.wrestler_id) : undefined;
              return (
                <li key={p.id} className="flex items-center gap-3 px-4 py-2">
                  {w && <WrestlerAvatar name={w.ring_name} assetId={w.portrait_asset_id} size={32} />}
                  <div className="min-w-0 flex-1">
                    {w ? <Link href={`${base}/roster/${w.id}`} className="block truncate text-sm font-medium hover:underline">{w.ring_name}</Link> : <span className="text-sm">Team</span>}
                    <p className="text-xs capitalize text-muted">{p.role} · side {p.side + 1}</p>
                  </div>
                  <form action={removeParticipantAction}>
                    {hidden}
                    <input type="hidden" name="participantId" value={p.id} />
                    <Button size="sm" variant="ghost" aria-label={`Remove ${w?.ring_name ?? "participant"}`}>✕</Button>
                  </form>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-border p-4">
            <ActionForm action={addParticipantAction} submitLabel="Add to cast" submitSize="sm" resetOnSuccess>
              {hidden}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Wrestler" htmlFor="wrestler_id" className="sm:col-span-3">
                  <Select id="wrestler_id" name="wrestler_id" defaultValue="">
                    <option value="" disabled>Choose…</option>
                    {state.wrestlers.filter((w) => !w.archived_at && !participants.some((p) => p.wrestler_id === w.id)).sort((a, b) => a.ring_name.localeCompare(b.ring_name)).map((w) => <option key={w.id} value={w.id}>{w.ring_name}</option>)}
                  </Select>
                </Field>
                <Field label="Role" htmlFor="role"><Select id="role" name="role" defaultValue="participant">{STORYLINE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</Select></Field>
                <Field label="Side" htmlFor="side"><Select id="side" name="side" defaultValue="0">{[0, 1, 2, 3].map((i) => <option key={i} value={i}>Side {i + 1}</option>)}</Select></Field>
              </div>
            </ActionForm>
          </div>
        </Card>

        <Card>
          <CardHeader title="Progress" />
          <div className="space-y-4 p-4">
            <ActionForm action={addDevelopmentAction} submitLabel="Add development" submitSize="sm" resetOnSuccess>
              {hidden}
              <Field label="What happened?" htmlFor="summary"><Input id="summary" name="summary" maxLength={1000} required placeholder="e.g. Crowe attacked Vane in the parking lot" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type" htmlFor="dev-kind">
                  <Select id="dev-kind" name="kind" defaultValue="development">
                    {["development", "betrayal", "escalation", "setback", "climax", "note"].map((k) => <option key={k} value={k}>{k}</option>)}
                  </Select>
                </Field>
                <Field label="Intensity change" htmlFor="intensity_delta"><Input id="intensity_delta" name="intensity_delta" type="number" min={-50} max={50} defaultValue={5} /></Field>
              </div>
            </ActionForm>
            <details>
              <summary className="cursor-pointer text-sm font-medium">Change status</summary>
              <ActionForm action={setStorylineStatusAction} submitLabel="Update status" submitSize="sm" submitVariant="secondary" className="mt-3">
                {hidden}
                <Field label="Status" htmlFor="status"><Select id="status" name="status" defaultValue={s.status}>{STORYLINE_STATUSES.map((x) => <option key={x} value={x}>{STORYLINE_STATUS_LABELS[x]}</option>)}</Select></Field>
                <Field label="Resolution (when ending)" htmlFor="resolution"><Input id="resolution" name="resolution" maxLength={1000} /></Field>
              </ActionForm>
            </details>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Timeline" />
          <ol className="divide-y divide-border">
            {developments.map((d) => (
              <li key={d.id} className="flex gap-3 px-4 py-2.5 text-sm">
                <span className="w-20 shrink-0 text-xs text-muted">{formatGameDate(d.occurred_on)}</span>
                <span className="min-w-0 flex-1">
                  <Badge className="mr-1.5">{d.kind}</Badge>
                  {d.summary}
                  {d.show_id && shows.get(d.show_id) && <> · <Link href={`${base}/booking/${d.show_id}`} className="text-accent">{shows.get(d.show_id)!.name}</Link></>}
                </span>
                {d.intensity_delta !== 0 && <span className={d.intensity_delta > 0 ? "shrink-0 text-xs font-semibold text-rivalry" : "shrink-0 text-xs text-muted"}>{d.intensity_delta > 0 ? "+" : ""}{d.intensity_delta}</span>}
              </li>
            ))}
            {developments.length === 0 && <li className="p-4 text-sm text-muted">Nothing has happened yet. Book segments tied to this storyline.</li>}
          </ol>
        </Card>

        <Card className="lg:col-span-2">
          <details>
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Edit storyline</summary>
            <div className="border-t border-border p-4">
              <ActionForm action={saveStorylineAction} submitLabel="Save storyline">
                {hidden}
                <StorylineFields storyline={s} promotions={state.promotions.filter((p) => !p.archived_at)} championships={state.championships.filter((c) => c.status === "active")} />
              </ActionForm>
            </div>
          </details>
        </Card>
      </div>
    </>
  );
}
