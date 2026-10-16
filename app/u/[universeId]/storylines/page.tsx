import type { Metadata } from "next";
import Link from "next/link";
import { getUniverseState } from "@/lib/game/load";
import { activeStorylines, indexById } from "@/lib/domain/selectors";
import { STORYLINE_KIND_LABELS, STORYLINE_STATUS_LABELS } from "@/lib/domain/enums";
import { formatGameDate } from "@/lib/domain/dates";
import { Badge, Button, Card, CardHeader, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { endRivalryAction } from "@/features/storylines/actions";

export const metadata: Metadata = { title: "Storylines" };

export default async function StorylinesPage({ params }: { params: Promise<{ universeId: string }> }) {
  const { universeId } = await params;
  const state = await getUniverseState(universeId);
  const base = `/u/${universeId}`;
  const wrestlers = indexById(state.wrestlers);
  const active = activeStorylines(state).sort((a, b) => b.intensity - a.intensity);
  const finished = state.storylines.filter((s) => s.status === "resolved" || s.status === "abandoned").sort((a, b) => ((a.resolved_on ?? "") < (b.resolved_on ?? "") ? 1 : -1));
  const rivalries = state.rivalries.filter((r) => r.ended_on === null).sort((a, b) => b.intensity - a.intensity);
  const who = (id: string) =>
    state.storylineParticipants
      .filter((p) => p.storyline_id === id && p.wrestler_id)
      .sort((a, b) => a.side - b.side)
      .map((p) => wrestlers.get(p.wrestler_id!)?.ring_name)
      .join(", ");
  return (
    <>
      <PageHeader title="Storylines" back={{ href: `${base}/more`, label: "More" }} actions={<LinkButton href={`${base}/storylines/new`} size="sm">New storyline</LinkButton>} />
      {active.length === 0 ? (
        <EmptyState title="No active storylines" description="Stories give matches stakes and make crowds care." action={<LinkButton href={`${base}/storylines/new`} size="sm">Start a storyline</LinkButton>} />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {active.map((s) => (
            <li key={s.id}>
              <Link href={`${base}/storylines/${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate font-semibold">{s.title}</span>
                    <Badge tone="rivalry">{STORYLINE_STATUS_LABELS[s.status]}</Badge>
                    <Badge>{STORYLINE_KIND_LABELS[s.kind]}</Badge>
                  </div>
                  <p className="truncate text-xs text-muted">{who(s.id)}</p>
                </div>
                <div className="w-16 shrink-0">
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full bg-rivalry" style={{ width: `${s.intensity}%` }} /></div>
                  <p className="mt-0.5 text-right text-xs font-semibold tabular-nums text-rivalry">{s.intensity}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Card className="mt-6">
        <CardHeader title="Rivalries" subtitle="Formed automatically when wrestlers keep crossing paths." />
        <ul className="divide-y divide-border">
          {rivalries.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                <Link href={`${base}/roster/${r.wrestler_a}`} className="font-medium hover:underline">{wrestlers.get(r.wrestler_a)?.ring_name}</Link> vs.{" "}
                <Link href={`${base}/roster/${r.wrestler_b}`} className="font-medium hover:underline">{wrestlers.get(r.wrestler_b)?.ring_name}</Link>
                <span className="block text-xs text-muted">{r.matches} match(es) · last {formatGameDate(r.last_interaction_on)}</span>
              </span>
              <span className="font-semibold tabular-nums text-rivalry">{r.intensity}</span>
              <form action={endRivalryAction}>
                <input type="hidden" name="universeId" value={universeId} />
                <input type="hidden" name="rivalryId" value={r.id} />
                <Button size="sm" variant="ghost" aria-label="End rivalry">End</Button>
              </form>
            </li>
          ))}
          {rivalries.length === 0 && <li className="p-4 text-sm text-muted">No active rivalries.</li>}
        </ul>
      </Card>

      {finished.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Concluded" />
          <ul className="divide-y divide-border">
            {finished.map((s) => (
              <li key={s.id}><Link href={`${base}/storylines/${s.id}`} className="flex justify-between gap-2 px-4 py-2 text-sm hover:bg-surface-2"><span className="truncate">{s.title}</span><span className="shrink-0 text-xs text-muted">{STORYLINE_STATUS_LABELS[s.status]}{s.resolved_on ? ` · ${formatGameDate(s.resolved_on)}` : ""}</span></Link></li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
