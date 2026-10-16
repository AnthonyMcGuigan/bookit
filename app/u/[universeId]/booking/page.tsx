import type { Metadata } from "next";
import Link from "next/link";
import { getUniverseState } from "@/lib/game/load";
import { completedShows, indexById, playerPromotions, upcomingShows } from "@/lib/domain/selectors";
import { SHOW_TYPE_LABELS } from "@/lib/domain/enums";
import { addDays, daysBetween, formatGameDate } from "@/lib/domain/dates";
import { Badge, Card, CardHeader, Field, Input, PageHeader, Stars, cx } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { advanceTimeAction, saveShowAction } from "@/features/booking/actions";
import { ShowFields } from "@/features/booking/show-fields";
import { starRatingFor } from "@/lib/simulation/scoring";

export const metadata: Metadata = { title: "Booking" };

export default async function BookingPage({ params }: { params: Promise<{ universeId: string }> }) {
  const { universeId } = await params;
  const state = await getUniverseState(universeId);
  const base = `/u/${universeId}`;
  const today = state.universe.game_date;
  const promos = indexById(state.promotions);
  const players = playerPromotions(state);
  const playerIds = new Set(players.map((p) => p.id));
  const upcoming = upcomingShows(state);
  const segCount = new Map<string, number>();
  for (const s of state.segments) segCount.set(s.show_id, (segCount.get(s.show_id) ?? 0) + 1);
  const recent = completedShows(state).slice(0, 10);
  const nextPlayer = upcoming.find((s) => playerIds.has(s.promotion_id));
  const lastPlayerShow = state.shows.filter((s) => playerIds.has(s.promotion_id)).sort((a, b) => (a.show_date < b.show_date ? 1 : -1))[0];
  const suggestedDate = lastPlayerShow && lastPlayerShow.show_date >= today ? addDays(lastPlayerShow.show_date, 7) : addDays(today, 7);

  return (
    <>
      <PageHeader title="Booking" subtitle={`Today is ${formatGameDate(today, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}`} />
      <Card className="mb-4">
        <CardHeader title="Calendar" subtitle="Your shows and your rivals'. Rival shows run automatically as time passes." />
        <ul className="divide-y divide-border" data-testid="upcoming-shows">
          {upcoming.length === 0 && <li className="p-4 text-sm text-muted">Nothing scheduled. Schedule a show below.</li>}
          {upcoming.map((s) => {
            const mine = playerIds.has(s.promotion_id);
            const promo = promos.get(s.promotion_id);
            const days = daysBetween(today, s.show_date);
            return (
              <li key={s.id}>
                <Link href={`${base}/booking/${s.id}`} className={cx("flex items-center gap-3 px-4 py-3 hover:bg-surface-2", !mine && "opacity-75")}>
                  <div className="w-14 shrink-0 text-center">
                    <p className="text-[11px] font-semibold uppercase text-muted">{formatGameDate(s.show_date, { month: "short" })}</p>
                    <p className="text-xl font-bold leading-tight">{formatGameDate(s.show_date, { day: "numeric" })}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{s.name}</p>
                    <p className="truncate text-xs text-muted">{promo?.abbreviation} · {SHOW_TYPE_LABELS[s.show_type]} · {segCount.get(s.id) ?? 0} segment(s) · {days === 0 ? "today" : `in ${days} day(s)`}</p>
                  </div>
                  {mine ? (
                    <Badge tone={s.status === "booked" ? "success" : s.id === nextPlayer?.id ? "upcoming" : "neutral"}>{s.status === "booked" ? "Card set" : "Draft"}</Badge>
                  ) : (
                    <Badge>Rival</Badge>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Schedule a show" />
          <div className="p-4">
            {players.length === 0 ? (
              <p className="text-sm text-muted">You don’t control any promotion. Set one to “You” on the Promotions page.</p>
            ) : (
              <ActionForm action={saveShowAction} submitLabel="Create show">
                <input type="hidden" name="universeId" value={universeId} />
                <ShowFields promotions={players} venues={state.venues} minDate={today} defaultDate={suggestedDate} />
              </ActionForm>
            )}
          </div>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Advance time" subtitle="Moves the calendar without one of your shows: recovery, contracts, payroll and rival shows still happen." />
            <div className="p-4">
              {nextPlayer ? (
                <p className="text-sm text-muted">Your next show, <Link className="text-accent" href={`${base}/booking/${nextPlayer.id}`}>{nextPlayer.name}</Link>, is on {formatGameDate(nextPlayer.show_date)}. You can advance up to the day before it, or simulate it to move forward.</p>
              ) : null}
              <ActionForm action={advanceTimeAction} submitLabel="Advance" submitVariant="secondary" className="mt-3" confirm="Advance the calendar? This can't be undone.">
                <input type="hidden" name="universeId" value={universeId} />
                <Field label="Days" htmlFor="days"><Input id="days" name="days" type="number" min={1} max={nextPlayer ? Math.max(1, daysBetween(today, nextPlayer.show_date) - 1) : 60} defaultValue={nextPlayer ? Math.max(1, Math.min(7, daysBetween(today, nextPlayer.show_date) - 1)) : 7} /></Field>
              </ActionForm>
            </div>
          </Card>
          <Card>
            <CardHeader title="Recent results" action={<Link href={`${base}/history`} className="text-xs text-accent">History</Link>} />
            <ul className="divide-y divide-border">
              {recent.map((s) => (
                <li key={s.id}>
                  <Link href={`${base}/booking/${s.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted">{promos.get(s.promotion_id)?.abbreviation} · {formatGameDate(s.show_date)}</p>
                    </div>
                    <Stars value={starRatingFor((s.rating ?? 0) * 20)} />
                  </Link>
                </li>
              ))}
              {recent.length === 0 && <li className="p-4 text-sm text-muted">No shows yet.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
