import type { Metadata } from "next";
import Link from "next/link";
import { getUniverseState } from "@/lib/game/load";
import {
  activeInjuries,
  activeStorylines,
  completedShows,
  currentChampions,
  indexById,
  playerPromotions,
  upcomingShows,
} from "@/lib/domain/selectors";
import { formatGameDate, daysBetween } from "@/lib/domain/dates";
import { SHOW_TYPE_LABELS, STORYLINE_STATUS_LABELS } from "@/lib/domain/enums";
import { Alert, Badge, Card, CardHeader, EmptyState, LinkButton, PageHeader, Stars, formatMoney } from "@/components/ui";
import { ChampionshipArt, WrestlerAvatar } from "@/components/artwork";
import { starRatingFor } from "@/lib/simulation/scoring";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ params, searchParams }: { params: Promise<{ universeId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { universeId } = await params;
  const query = await searchParams;
  const state = await getUniverseState(universeId);
  const base = `/u/${universeId}`;
  const wrestlers = indexById(state.wrestlers);
  const players = playerPromotions(state);
  const playerIds = new Set(players.map((p) => p.id));
  const upcoming = upcomingShows(state);
  const nextPlayerShow = upcoming.find((s) => playerIds.has(s.promotion_id));
  const recent = completedShows(state).slice(0, 4);
  const champions = currentChampions(state);
  const injuries = activeInjuries(state).filter((i) => !i.is_storyline || true).slice(0, 8);
  const storylines = activeStorylines(state).sort((a, b) => b.intensity - a.intensity).slice(0, 5);
  const momentum = state.wrestlers
    .filter((w) => !w.archived_at && w.career_status === "active" && w.role !== "manager")
    .sort((a, b) => b.momentum + b.popularity / 2 - (a.momentum + a.popularity / 2))
    .slice(0, 6);
  const timeline = state.timelineEvents.slice().sort((a, b) => (a.occurred_on < b.occurred_on ? 1 : a.occurred_on > b.occurred_on ? -1 : 0)).slice(0, 8);
  const promoById = indexById(state.promotions);
  const settings = state.universe.settings;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`${players.map((p) => p.name).join(" · ") || "No player promotion"} — ${formatGameDate(state.universe.game_date)}`}
        actions={<LinkButton href={`${base}/booking`} size="sm">Open booking</LinkButton>}
      />

      {query.imported && (
        <div className="mb-4" data-testid="import-complete">
          <Alert tone="success" title="Import complete">
            {Number(query.imported).toLocaleString("en-US")} record(s) imported.{query.warnings ? ` ${query.warnings}` : ""}
          </Alert>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Next show" subtitle={nextPlayerShow ? `${daysBetween(state.universe.game_date, nextPlayerShow.show_date)} day(s) away` : undefined} />
          <div className="p-4">
            {nextPlayerShow ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="upcoming">{SHOW_TYPE_LABELS[nextPlayerShow.show_type]}</Badge>
                    <Badge>{nextPlayerShow.status === "booked" ? "Card set" : "Draft"}</Badge>
                  </div>
                  <p className="mt-1 text-lg font-bold">{nextPlayerShow.name}</p>
                  <p className="text-sm text-muted">
                    {formatGameDate(nextPlayerShow.show_date, { weekday: "long", month: "short", day: "numeric", year: "numeric" })} ·{" "}
                    {state.segments.filter((s) => s.show_id === nextPlayerShow.id).length} segment(s) booked
                  </p>
                </div>
                <LinkButton href={`${base}/booking/${nextPlayerShow.id}`}>{nextPlayerShow.status === "booked" ? "Review & simulate" : "Book this show"}</LinkButton>
              </div>
            ) : (
              <EmptyState title="Nothing scheduled" description="Schedule your next show to keep the world moving." action={<LinkButton href={`${base}/booking`} size="sm">Schedule a show</LinkButton>} />
            )}
          </div>
        </Card>

        {settings.financesEnabled ? (
          <Card>
            <CardHeader title="Finances" action={<Link href={`${base}/finances`} className="text-xs text-accent">Details</Link>} />
            <ul className="divide-y divide-border">
              {players.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span>{p.abbreviation}</span>
                  <span className={p.cash_balance < 0 ? "font-semibold text-danger" : "font-semibold"}>{formatMoney(p.cash_balance, settings.currency)}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <Card>
            <CardHeader title="Universe" />
            <div className="space-y-1 p-4 text-sm text-muted">
              <p>{state.wrestlers.length} wrestlers · {state.promotions.length} promotion(s)</p>
              <p>{state.championships.length} championships · {state.storylines.length} storylines</p>
              <p>Finances are off. <Link href={`${base}/settings`} className="text-accent">Change settings</Link></p>
            </div>
          </Card>
        )}

        <Card className="lg:col-span-2">
          <CardHeader title="Champions" action={<Link href={`${base}/championships`} className="text-xs text-accent">All titles</Link>} />
          {champions.length === 0 ? (
            <div className="p-4"><EmptyState title="No championships yet" action={<LinkButton href={`${base}/championships/new`} size="sm">Create a championship</LinkButton>} /></div>
          ) : (
            <ul className="grid divide-y divide-border sm:grid-cols-2 sm:divide-y-0">
              {champions.map(({ championship, reign }) => (
                <li key={championship.id} className="border-border sm:border-b">
                  <Link href={`${base}/championships/${championship.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                    <ChampionshipArt name={championship.name} assetId={championship.image_asset_id} tier={championship.tier} size={40} />
                    <div className="min-w-0">
                      <p className="truncate text-xs text-muted">{championship.name}</p>
                      <p className="truncate font-semibold text-gold">{reign ? reign.holders.map((h) => h.ring_name).join(" & ") : "Vacant"}</p>
                      {reign && <p className="text-xs text-muted">{reign.days} days · {reign.reign.defenses} defense(s)</p>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Injuries" />
          {injuries.length === 0 ? (
            <p className="p-4 text-sm text-muted">Everyone is fit to compete.</p>
          ) : (
            <ul className="divide-y divide-border">
              {injuries.map((i) => {
                const w = wrestlers.get(i.wrestler_id);
                return (
                  <li key={i.id}>
                    <Link href={`${base}/roster/${i.wrestler_id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-surface-2">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{w?.ring_name}</span>
                        <span className="block truncate text-xs text-danger">{i.description}{i.is_storyline ? " (storyline)" : ""}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted">back {formatGameDate(i.expected_return_on, { month: "short", day: "numeric" })}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Hottest storylines" action={<Link href={`${base}/storylines`} className="text-xs text-accent">All storylines</Link>} />
          {storylines.length === 0 ? (
            <p className="p-4 text-sm text-muted">No active storylines. <Link href={`${base}/storylines`} className="text-accent">Start one</Link>.</p>
          ) : (
            <ul className="divide-y divide-border">
              {storylines.map((s) => (
                <li key={s.id}>
                  <Link href={`${base}/storylines/${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{s.title}</p>
                      <p className="truncate text-xs text-muted">
                        {state.storylineParticipants.filter((p) => p.storyline_id === s.id && p.wrestler_id).map((p) => wrestlers.get(p.wrestler_id!)?.ring_name).join(" vs. ")}
                      </p>
                    </div>
                    <Badge tone="rivalry">{STORYLINE_STATUS_LABELS[s.status]}</Badge>
                    <span className="w-10 text-right text-sm font-semibold tabular-nums text-rivalry" title="Intensity">{s.intensity}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Momentum leaders" />
          <ul className="divide-y divide-border">
            {momentum.map((w) => (
              <li key={w.id}>
                <Link href={`${base}/roster/${w.id}`} className="flex items-center gap-3 px-4 py-2 hover:bg-surface-2">
                  <WrestlerAvatar name={w.ring_name} assetId={w.portrait_asset_id} size={32} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{w.ring_name}</span>
                  <span className={w.momentum >= 0 ? "text-sm font-semibold text-success" : "text-sm font-semibold text-danger"}>{w.momentum > 0 ? "+" : ""}{w.momentum}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Recent results" action={<Link href={`${base}/history`} className="text-xs text-accent">History</Link>} />
          {recent.length === 0 ? (
            <p className="p-4 text-sm text-muted">No shows simulated yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((s) => (
                <li key={s.id}>
                  <Link href={`${base}/booking/${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{s.name}</p>
                      <p className="text-xs text-muted">{promoById.get(s.promotion_id)?.abbreviation} · {formatGameDate(s.show_date)} · {s.attendance?.toLocaleString("en-US")} fans</p>
                    </div>
                    <Stars value={starRatingFor((s.rating ?? 0) * 20)} />
                    <span className="w-10 text-right text-sm font-semibold tabular-nums">{s.rating?.toFixed(2)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Upcoming events" />
          <ul className="divide-y divide-border">
            {upcoming.slice(0, 6).map((s) => (
              <li key={s.id}>
                <Link href={`${base}/booking/${s.id}`} className="block px-4 py-2.5 hover:bg-surface-2">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-upcoming">{promoById.get(s.promotion_id)?.abbreviation} · {formatGameDate(s.show_date)}</p>
                </Link>
              </li>
            ))}
            {upcoming.length === 0 && <li className="p-4 text-sm text-muted">Nothing scheduled.</li>}
          </ul>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader title="Around the industry" action={<Link href={`${base}/history`} className="text-xs text-accent">Full timeline</Link>} />
          <ul className="divide-y divide-border">
            {timeline.map((e) => (
              <li key={e.id} className="flex gap-3 px-4 py-2.5 text-sm">
                <span className="w-16 shrink-0 text-xs text-muted">{formatGameDate(e.occurred_on, { month: "short", day: "numeric" })}</span>
                <span className="min-w-0">
                  <span className={e.kind === "title_change" ? "font-semibold text-gold" : e.kind === "injury" ? "font-medium text-danger" : "font-medium"}>{e.title}</span>
                  {e.summary && <span className="block truncate text-xs text-muted">{e.summary}</span>}
                </span>
              </li>
            ))}
            {timeline.length === 0 && <li className="p-4 text-sm text-muted">The history books are empty — for now.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
