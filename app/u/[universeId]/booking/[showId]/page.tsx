import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUniverseState } from "@/lib/game/load";
import { indexById, participantsOf, segmentsOf } from "@/lib/domain/selectors";
import { CROWD_REACTION_LABELS, FINISH_LABELS, MATCH_TYPE_LABELS, SEGMENT_KIND_LABELS, SHOW_TYPE_LABELS, STIPULATION_LABELS, type Finish } from "@/lib/domain/enums";
import { daysBetween, formatGameDate } from "@/lib/domain/dates";
import { Alert, Badge, Card, CardHeader, Checkbox, Field, Input, LinkButton, PageHeader, Select, Stars, Stat, Textarea, formatMoney } from "@/components/ui";
import { PosterArt, PromotionLogo } from "@/components/artwork";
import { ActionForm } from "@/components/action-form";
import { validateCard } from "@/lib/booking/validate";
import { blockingProblems } from "@/lib/simulation/plan";
import { starRatingFor } from "@/lib/simulation/scoring";
import { autoBookAction, deleteShowAction, editResultAction, saveShowAction, setShowStatusAction, simulateShowAction } from "@/features/booking/actions";
import { ShowFields } from "@/features/booking/show-fields";
import { CardList, type CardItem } from "@/features/booking/card-list";
import { ImageUpload } from "@/components/image-upload";
import { removeEntityImageAction, uploadEntityImageAction } from "@/features/media/actions";
import type { SegmentOutcome, ShowFinances, ShowRatingBreakdown } from "@/lib/simulation/types";

export const metadata: Metadata = { title: "Show" };

const COMPONENTS: Array<[keyof ShowRatingBreakdown, string]> = [
  ["segmentAverage", "Segment quality"],
  ["mainEvent", "Main event"],
  ["opener", "Opener"],
  ["pacing", "Pacing"],
  ["starPower", "Star power"],
  ["stakes", "Stakes"],
  ["storyProgression", "Story progression"],
  ["repetition", "Freshness"],
  ["length", "Length"],
  ["crowd", "Crowd"],
  ["expectations", "Expectations"],
];

export default async function ShowPage({ params, searchParams }: { params: Promise<{ universeId: string; showId: string }>; searchParams: Promise<{ simulated?: string }> }) {
  const { universeId, showId } = await params;
  const { simulated } = await searchParams;
  const state = await getUniverseState(universeId);
  const show = state.shows.find((s) => s.id === showId);
  if (!show) notFound();
  const base = `/u/${universeId}`;
  const promotion = state.promotions.find((p) => p.id === show.promotion_id)!;
  const isPlayer = promotion.controlled_by === "player";
  const wrestlers = indexById(state.wrestlers);
  const champs = indexById(state.championships);
  const storylines = indexById(state.storylines);
  const segments = segmentsOf(state, show.id);
  const settings = state.universe.settings;
  const hidden = (
    <>
      <input type="hidden" name="universeId" value={universeId} />
      <input type="hidden" name="showId" value={show.id} />
    </>
  );
  const describe = (segmentId: string) => {
    const parts = participantsOf(state, segmentId);
    const bySide = new Map<number, string[]>();
    for (const p of parts) {
      const n = wrestlers.get(p.wrestler_id)?.ring_name ?? "?";
      bySide.set(p.side, [...(bySide.get(p.side) ?? []), p.role === "manager" ? `(w/ ${n})` : n]);
    }
    return [...bySide.values()].map((names) => names.join(" & ").replace(/ & \(w\//g, " (w/")).join(" vs. ");
  };

  const header = (
    <>
    {show.poster_asset_id && <PosterArt title={show.name} assetId={show.poster_asset_id} className="mb-4" />}
    <PageHeader
      back={{ href: `${base}/booking`, label: "Booking" }}
      title={<span className="flex items-center gap-3"><PromotionLogo name={promotion.name} abbreviation={promotion.abbreviation} primary={promotion.primary_color} secondary={promotion.secondary_color} assetId={promotion.logo_asset_id} size={40} /><span className="min-w-0 truncate">{show.name}</span></span>}
      subtitle={`${SHOW_TYPE_LABELS[show.show_type]}${show.custom_type_label ? ` (${show.custom_type_label})` : ""} · ${formatGameDate(show.show_date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}${show.venue_id ? ` · ${state.venues.find((v) => v.id === show.venue_id)?.name ?? ""}` : ""}`}
    />
    </>
  );

  // ---------------------------------------------------------------- Results
  if (show.status === "completed") {
    const breakdown = (show.rating_breakdown ?? {}) as Partial<ShowRatingBreakdown> & { finances?: ShowFinances; summary?: string };
    const results = new Map(state.segmentResults.filter((r) => r.show_id === show.id).map((r) => [r.segment_id, r]));
    const timeline = state.timelineEvents.filter((e) => e.show_id === show.id && e.kind !== "show");
    return (
      <>
        {header}
        {simulated && <div className="mb-4"><Alert tone="success" title="Show complete">Results are saved. The universe moved to {formatGameDate(state.universe.game_date)}.</Alert></div>}
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="show-summary">
          <Stat label="Show rating" value={<span data-testid="show-rating">{show.rating?.toFixed(2)}</span>} hint={<Stars value={starRatingFor((show.rating ?? 0) * 20)} />} />
          <Stat label="Attendance" value={show.attendance?.toLocaleString("en-US") ?? "—"} hint={breakdown.finances ? `of ${breakdown.finances.capacity.toLocaleString("en-US")}` : undefined} />
          {breakdown.finances?.enabled ? (
            <>
              <Stat label="Revenue" value={formatMoney(breakdown.finances.revenue, settings.currency)} />
              <Stat label="Profit" value={<span className={breakdown.finances.profit < 0 ? "text-danger" : "text-success"}>{formatMoney(breakdown.finances.profit, settings.currency)}</span>} />
            </>
          ) : (
            <>
              <Stat label="Segments" value={segments.length} />
              <Stat label="Runtime" value={`${segments.reduce((t, s) => t + s.duration_min, 0)}m`} />
            </>
          )}
        </div>
        {breakdown.summary && <p className="mb-4 text-sm">{breakdown.summary}</p>}

        <Card className="mb-4">
          <CardHeader title="Results" />
          <ol className="divide-y divide-border" data-testid="results">
            {segments.map((seg, i) => {
              const r = results.get(seg.id);
              const outcome = (r?.details ?? {}) as Partial<SegmentOutcome>;
              const parts = participantsOf(state, seg.id);
              const sides = [...new Set(parts.map((p) => p.side))];
              return (
                <li key={seg.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-semibold text-muted">{i + 1}.</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{seg.kind === "match" ? `${MATCH_TYPE_LABELS[seg.match_type ?? "singles"]}${seg.stipulation && seg.stipulation !== "standard" ? ` · ${STIPULATION_LABELS[seg.stipulation]}` : ""}` : SEGMENT_KIND_LABELS[seg.kind]}</span>
                    {seg.championship_id && <Badge tone="gold">{champs.get(seg.championship_id)?.name}</Badge>}
                    {r?.title_changed && <Badge tone="gold">New champion!</Badge>}
                    {r?.manually_edited && <Badge>Edited</Badge>}
                    {outcome.match?.upset && <Badge tone="rivalry">Upset</Badge>}
                    {outcome.injuries?.length ? <Badge tone="danger">Injury</Badge> : null}
                  </div>
                  <p className="font-medium">{describe(seg.id)}</p>
                  {seg.title && <p className="text-xs text-muted">{seg.title}</p>}
                  {r && (
                    <>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm">
                        <Stars value={r.star_rating} />
                        <span className="text-xs text-muted">Crowd: {CROWD_REACTION_LABELS[r.crowd_reaction]}</span>
                        {r.finish && <span className="text-xs text-muted">{FINISH_LABELS[r.finish as Finish] ?? r.finish}</span>}
                        <span className="text-xs text-muted">{r.duration_min} min</span>
                      </p>
                      <p className="mt-1 text-sm">{r.recap}</p>
                      {outcome.title_outcome?.note && <p className="mt-1 text-xs text-gold">{outcome.title_outcome.note}</p>}
                      {outcome.factors && outcome.factors.length > 0 && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs text-muted">Why this rating?</summary>
                          <ul className="mt-1 list-disc pl-5 text-xs text-muted">{outcome.factors.map((f, k) => <li key={k}>{f}</li>)}</ul>
                        </details>
                      )}
                      {isPlayer && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs text-accent">Edit result</summary>
                          <div className="mt-2 space-y-2 rounded-lg border border-border p-3">
                            <Alert tone="gold">Editing a result changes the record only. Title changes, stats and storyline effects that already happened are not recalculated.</Alert>
                            <ActionForm action={editResultAction} submitLabel="Save result" submitSize="sm">
                              {hidden}
                              <input type="hidden" name="segmentId" value={seg.id} />
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {seg.kind === "match" && (
                                  <Field label="Winner" htmlFor={`w-${seg.id}`}>
                                    <Select id={`w-${seg.id}`} name="winner_side" defaultValue={r.winner_side ?? ""}>
                                      <option value="">No winner (draw / no contest)</option>
                                      {sides.map((s) => <option key={s} value={s}>{parts.filter((p) => p.side === s).map((p) => wrestlers.get(p.wrestler_id)?.ring_name).join(" & ")}</option>)}
                                    </Select>
                                  </Field>
                                )}
                                <Field label="Star rating (0–5)" htmlFor={`sr-${seg.id}`}><Input id={`sr-${seg.id}`} name="star_rating" type="number" step="0.25" min={0} max={5} defaultValue={r.star_rating} /></Field>
                                <Field label="Recap" htmlFor={`rc-${seg.id}`} className="sm:col-span-2"><Textarea id={`rc-${seg.id}`} name="recap" defaultValue={r.recap} maxLength={4000} /></Field>
                              </div>
                              <Checkbox name="acknowledge" label="I understand" />
                            </ActionForm>
                          </div>
                        </details>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Rating breakdown" subtitle={`Overall score ${Math.round(breakdown.total ?? 0)}/100`} />
            <ul className="divide-y divide-border">
              {COMPONENTS.map(([key, label]) => {
                const v = Number(breakdown[key] ?? 0);
                return (
                  <li key={key} className="flex justify-between px-4 py-1.5 text-sm">
                    <span>{label}</span>
                    <span className={key === "segmentAverage" ? "font-semibold" : v > 0 ? "font-semibold text-success" : v < 0 ? "font-semibold text-danger" : "text-muted"}>
                      {key === "segmentAverage" ? v.toFixed(1) : `${v > 0 ? "+" : ""}${v.toFixed(1)}`}
                    </span>
                  </li>
                );
              })}
            </ul>
            {breakdown.notes && breakdown.notes.length > 0 && <ul className="list-disc border-t border-border py-2 pl-9 pr-4 text-xs text-muted">{breakdown.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
          </Card>
          <div className="space-y-4">
            {breakdown.finances?.enabled && (
              <Card>
                <CardHeader title="Show finances" />
                <ul className="divide-y divide-border">
                  {breakdown.finances.lines.map((l, i) => (
                    <li key={i} className="flex justify-between gap-2 px-4 py-1.5 text-sm"><span className="truncate">{l.description}</span><span className={l.amount < 0 ? "text-danger" : "text-success"}>{formatMoney(l.amount, settings.currency)}</span></li>
                  ))}
                </ul>
                <ul className="list-disc border-t border-border py-2 pl-9 pr-4 text-xs text-muted">{breakdown.finances.explanation.map((n, i) => <li key={i}>{n}</li>)}</ul>
              </Card>
            )}
            <Card>
              <CardHeader title="Fallout" />
              <ul className="divide-y divide-border">
                {timeline.map((e) => <li key={e.id} className={e.kind === "title_change" ? "px-4 py-2 text-sm font-medium text-gold" : e.kind === "injury" ? "px-4 py-2 text-sm text-danger" : "px-4 py-2 text-sm"}>{e.title}</li>)}
                {timeline.length === 0 && <li className="p-4 text-sm text-muted">No major fallout.</li>}
              </ul>
            </Card>
          </div>
        </div>
      </>
    );
  }

  // ---------------------------------------------------------------- Editor
  const warnings = validateCard(state, show.id);
  const problems = blockingProblems(state, show);
  const pendingEarlier = state.shows.find(
    (s) => s.id !== show.id && (s.status === "draft" || s.status === "booked") && s.show_date < show.show_date && state.promotions.find((p) => p.id === s.promotion_id)?.controlled_by === "player",
  );
  const items: CardItem[] = segments.map((seg) => ({
    id: seg.id,
    kindLabel: seg.kind === "match" ? `${MATCH_TYPE_LABELS[seg.match_type ?? "singles"]}${seg.stipulation && seg.stipulation !== "standard" ? ` · ${STIPULATION_LABELS[seg.stipulation]}` : ""}` : seg.kind === "custom" && seg.custom_kind_label ? seg.custom_kind_label : SEGMENT_KIND_LABELS[seg.kind],
    title: seg.title,
    participants: describe(seg.id),
    duration: seg.duration_min,
    badges: [
      ...(seg.championship_id ? [{ label: champs.get(seg.championship_id)?.name ?? "Title", tone: "gold" as const }] : []),
      ...(seg.storyline_id ? [{ label: storylines.get(seg.storyline_id)?.title ?? "Storyline", tone: "rivalry" as const }] : []),
      ...(seg.predetermined_winner_side !== null ? [{ label: "Finish planned", tone: "neutral" as const }] : []),
    ],
    warnings: warnings.filter((w) => w.segmentId === seg.id && w.level === "warning").length,
  }));
  const days = daysBetween(state.universe.game_date, show.show_date);

  return (
    <>
      {header}
      {!isPlayer && <div className="mb-4"><Alert tone="upcoming">This is a rival promotion’s show. It will be booked and run automatically when the calendar reaches {formatGameDate(show.show_date)}.</Alert></div>}
      {show.status === "cancelled" && <div className="mb-4"><Alert tone="danger">This show is cancelled.</Alert></div>}
      <Card className="mb-4">
        <CardHeader
          title="Card"
          subtitle={`${show.status === "booked" ? "Card set" : "Draft"} · ${days === 0 ? "today" : `${days} day(s) away`} · target ${show.target_duration_min} min`}
          action={isPlayer && show.status !== "cancelled" ? <LinkButton href={`${base}/booking/${show.id}/segment/new`} size="sm">Add segment</LinkButton> : undefined}
        />
        {segments.length === 0 ? (
          <div className="p-4 text-sm text-muted">No segments yet. Add a match or promo, or let the auto-booker draft a card for you.</div>
        ) : (
          <CardList universeId={universeId} showId={show.id} items={items} editable={isPlayer && show.status !== "cancelled"} />
        )}
      </Card>

      {isPlayer && show.status !== "cancelled" && (
        <>
          {warnings.length > 0 && (
            <Card className="mb-4">
              <CardHeader title={`Booking notes (${warnings.length})`} subtitle="Warnings never stop you from simulating." />
              <ul className="divide-y divide-border" data-testid="warnings">
                {warnings.map((w, i) => <li key={i} className={w.level === "warning" ? "px-4 py-2 text-sm text-danger" : "px-4 py-2 text-sm text-muted"}>{w.message}</li>)}
              </ul>
            </Card>
          )}
          {settings.customRules && <div className="mb-4"><Alert title="House rules">{settings.customRules}</Alert></div>}

          <Card className="mb-4">
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                {problems.length > 0 ? (
                  <p className="text-danger">{problems[0]}</p>
                ) : pendingEarlier ? (
                  <p className="text-danger">Simulate <Link href={`${base}/booking/${pendingEarlier.id}`} className="underline">{pendingEarlier.name}</Link> first; it&apos;s earlier on the calendar.</p>
                ) : (
                  <p className="text-muted">Simulating moves the calendar to {formatGameDate(show.show_date)}, runs any rival shows before it, and saves the results permanently.</p>
                )}
              </div>
              <ActionForm action={simulateShowAction} submitLabel="Simulate show" pendingLabel="Simulating…" className="space-y-2" confirm="Simulate this show? Results are final.">
                {hidden}
              </ActionForm>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Tools" />
              <div className="space-y-3 p-4">
                <ActionForm action={autoBookAction} submitLabel={segments.length ? "Replace card with auto-booked card" : "Auto-book this show"} submitVariant="secondary" submitSize="sm" confirm={segments.length ? "Replace the whole card?" : undefined}>
                  {hidden}
                  <input type="hidden" name="replace" value={segments.length ? "true" : "false"} />
                </ActionForm>
                <ActionForm action={setShowStatusAction} submitLabel={show.status === "booked" ? "Reopen card" : "Mark card as set"} submitVariant="secondary" submitSize="sm">
                  {hidden}
                  <input type="hidden" name="status" value={show.status === "booked" ? "draft" : "booked"} />
                </ActionForm>
                <ActionForm action={setShowStatusAction} submitLabel="Cancel show" submitVariant="ghost" submitSize="sm" confirm="Cancel this show? It stays on the calendar as cancelled.">
                  {hidden}
                  <input type="hidden" name="status" value="cancelled" />
                </ActionForm>
              </div>
            </Card>
            <Card>
              <details>
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Show details</summary>
                <div className="border-t border-border p-4">
                  <div className="mb-4"><ImageUpload
            uploadAction={uploadEntityImageAction}
            removeAction={removeEntityImageAction}
            hasImage={Boolean(show.poster_asset_id)}
            label="Event poster"
            hidden={<><input type="hidden" name="universeId" value={universeId} /><input type="hidden" name="target" value="show" /><input type="hidden" name="entityId" value={show.id} /></>}
          />
</div>
                  <ActionForm action={saveShowAction} submitLabel="Save details">
                    {hidden}
                    <ShowFields show={show} promotions={state.promotions.filter((p) => p.controlled_by === "player" && !p.archived_at)} venues={state.venues} minDate={state.universe.game_date} defaultDate={show.show_date} />
                  </ActionForm>
                </div>
              </details>
            </Card>
          </div>
        </>
      )}
      {isPlayer && show.status === "cancelled" && (
        <div className="flex flex-wrap gap-2">
          <ActionForm action={setShowStatusAction} submitLabel="Restore show" submitVariant="secondary" submitSize="sm">
            {hidden}
            <input type="hidden" name="status" value="draft" />
          </ActionForm>
          <ActionForm action={deleteShowAction} submitLabel="Delete show" submitVariant="danger" submitSize="sm" confirm="Delete this show and its card permanently?">
            {hidden}
          </ActionForm>
        </div>
      )}
    </>
  );
}
