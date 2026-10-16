import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUniverseState, getWrestlerRecords } from "@/lib/game/load";
import { indexById, injuryFor, lineage, promotionsOf, rivalriesOf, storylinesOf, teamsOf, titlesHeldBy } from "@/lib/domain/selectors";
import { ATTRIBUTE_GROUPS, ATTRIBUTE_LABELS } from "@/lib/domain/entities";
import {
  ALIGNMENT_LABELS,
  CARD_POSITION_LABELS,
  DIVISION_LABELS,
  FINISH_LABELS,
  INJURY_SEVERITIES,
  INJURY_SEVERITY_LABELS,
  STORYLINE_STATUS_LABELS,
  TEAM_KIND_LABELS,
  WRESTLER_ROLE_LABELS,
  type Finish,
} from "@/lib/domain/enums";
import { formatGameDate, yearsBetween, daysBetween } from "@/lib/domain/dates";
import { Badge, Button, Card, CardHeader, Checkbox, Field, Input, LinkButton, PageHeader, Select, Stat, StatBar, Stars, cx, formatMoney } from "@/components/ui";
import { ChampionshipArt, WrestlerAvatar } from "@/components/artwork";
import { ActionForm } from "@/components/action-form";
import {
  addInjuryAction,
  healInjuryAction,
  releaseWrestlerAction,
  retireWrestlerAction,
  setWrestlerArchivedAction,
  signContractAction,
  transferWrestlerAction,
} from "@/features/roster/actions";
import { ContractFields } from "@/features/roster/wrestler-fields";

export const metadata: Metadata = { title: "Wrestler" };

export default async function WrestlerPage({ params }: { params: Promise<{ universeId: string; wrestlerId: string }> }) {
  const { universeId, wrestlerId } = await params;
  const [state, records] = await Promise.all([getUniverseState(universeId), getWrestlerRecords(universeId)]);
  const w = state.wrestlers.find((x) => x.id === wrestlerId);
  if (!w) notFound();
  const base = `/u/${universeId}`;
  const settings = state.universe.settings;
  const wrestlers = indexById(state.wrestlers);
  const promotions = promotionsOf(state, w.id);
  const allPromotions = state.promotions.filter((p) => !p.archived_at);
  const unsigned = allPromotions.filter((p) => !promotions.some((x) => x.id === p.id));
  const contracts = state.contracts.filter((c) => c.wrestler_id === w.id && c.status === "active");
  const injury = injuryFor(state, w.id);
  const record = records.get(w.id);
  const titles = titlesHeldBy(state, w.id);
  const reignHistory = state.championships.flatMap((c) =>
    lineage(state, c.id).filter((r) => r.holders.some((h) => h.id === w.id)),
  );
  const teams = teamsOf(state, w.id);
  const storylines = storylinesOf(state, w.id);
  const rivalries = rivalriesOf(state, w.id).slice(0, 5);
  const chemistry = state.chemistry
    .filter((c) => c.wrestler_a === w.id || c.wrestler_b === w.id)
    .map((c) => ({ other: wrestlers.get(c.wrestler_a === w.id ? c.wrestler_b : c.wrestler_a), partner: c.partner_score, opponent: c.opponent_score, together: c.matches_together, against: c.matches_against }))
    .filter((c) => c.other)
    .sort((a, b) => Math.abs(b.partner) + Math.abs(b.opponent) - (Math.abs(a.partner) + Math.abs(a.opponent)))
    .slice(0, 6);
  const showsById = indexById(state.shows);
  const segById = indexById(state.segments);
  const resultBySeg = new Map(state.segmentResults.map((r) => [r.segment_id, r]));
  const matches = state.segmentParticipants
    .filter((p) => p.wrestler_id === w.id && p.outcome)
    .map((p) => {
      const seg = segById.get(p.segment_id)!;
      const show = seg ? showsById.get(seg.show_id) : undefined;
      const others = state.segmentParticipants.filter((o) => o.segment_id === p.segment_id && o.side !== p.side && o.role === "competitor").map((o) => wrestlers.get(o.wrestler_id)?.ring_name).filter(Boolean);
      return { p, seg, show, others, result: resultBySeg.get(p.segment_id) };
    })
    .filter((m) => m.show && m.seg)
    .sort((a, b) => (a.show!.show_date < b.show!.show_date ? 1 : -1))
    .slice(0, 12);
  const timeline = state.timelineEvents.filter((e) => e.kind !== "show" && e.wrestler_ids.includes(w.id)).sort((a, b) => (a.occurred_on < b.occurred_on ? 1 : -1)).slice(0, 10);
  const age = w.birth_date ? yearsBetween(w.birth_date, state.universe.game_date) : null;
  const hidden = (
    <>
      <input type="hidden" name="universeId" value={universeId} />
      <input type="hidden" name="wrestlerId" value={w.id} />
    </>
  );

  return (
    <>
      <PageHeader
        back={{ href: `${base}/roster`, label: "Roster" }}
        title={
          <span className="flex items-center gap-3">
            <WrestlerAvatar name={w.ring_name} assetId={w.portrait_asset_id} size={56} />
            <span className="min-w-0">
              <span className="block truncate">{w.ring_name}</span>
              <span className="block text-sm font-normal text-muted">
                {[w.alternate_name && `“${w.alternate_name}”`, w.billed_from && `from ${w.billed_from}`].filter(Boolean).join(" · ")}
              </span>
            </span>
          </span>
        }
        actions={<LinkButton href={`${base}/roster/${w.id}/edit`} variant="secondary" size="sm">Edit</LinkButton>}
      />
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Badge tone={w.alignment === "face" ? "success" : w.alignment === "heel" ? "danger" : "neutral"}>{ALIGNMENT_LABELS[w.alignment]}</Badge>
        <Badge>{CARD_POSITION_LABELS[w.card_position]}</Badge>
        <Badge>{DIVISION_LABELS[w.division]}</Badge>
        {w.role !== "wrestler" && <Badge>{WRESTLER_ROLE_LABELS[w.role]}</Badge>}
        {titles.map((t) => <Badge key={t.id} tone="gold">{t.name}</Badge>)}
        {injury && <Badge tone="danger">Injured</Badge>}
        {w.career_status !== "active" && <Badge>{w.career_status}</Badge>}
        {w.archived_at && <Badge>Archived</Badge>}
        {promotions.length === 0 ? <Badge tone="upcoming">Free agent</Badge> : promotions.map((p) => <Badge key={p.id} tone="accent">{p.abbreviation}</Badge>)}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-6">
        <Stat label="Popularity" value={w.popularity} />
        <Stat label="Momentum" value={<span className={w.momentum > 0 ? "text-success" : w.momentum < 0 ? "text-danger" : ""}>{w.momentum > 0 ? "+" : ""}{w.momentum}</span>} />
        <Stat label="Morale" value={<span className={w.morale < 40 ? "text-danger" : ""}>{w.morale}</span>} />
        <Stat label="Fatigue" value={<span className={w.fatigue > 60 ? "text-danger" : ""}>{w.fatigue}</span>} />
        <Stat label="Record" value={record ? `${record.wins}-${record.losses}${record.draws ? `-${record.draws}` : ""}` : "0-0"} hint={record ? `${record.matches} matches` : undefined} />
        <Stat label="Reputation" value={w.reputation} hint={age !== null ? `Age ${age}` : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Attributes" subtitle="Each attribute is independent; there is no single overall rating." />
          <div className="space-y-4 p-4">
            {ATTRIBUTE_GROUPS.map((g) => (
              <div key={g.label} className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{g.label}</p>
                {g.keys.map((k) => <StatBar key={k} label={ATTRIBUTE_LABELS[k]} value={w[k]} tone={w[k] >= 80 ? "gold" : "accent"} />)}
              </div>
            ))}
            {w.finisher && <p className="text-sm"><span className="text-muted">Finisher:</span> {w.finisher}</p>}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Contracts" />
            <div className="divide-y divide-border">
              {contracts.length === 0 && <p className="p-4 text-sm text-muted">Not under contract.</p>}
              {contracts.map((c) => {
                const promo = state.promotions.find((p) => p.id === c.promotion_id);
                const others = allPromotions.filter((p) => p.id !== c.promotion_id);
                return (
                  <div key={c.id} className="space-y-3 p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-semibold">{promo?.name}</p>
                      <p className="text-xs text-muted">until {formatGameDate(c.ends_on)} ({Math.max(0, daysBetween(state.universe.game_date, c.ends_on))} days)</p>
                    </div>
                    <p className="text-sm text-muted">{formatMoney(c.weekly_salary, settings.currency)} / week{c.appearance_fee ? ` · ${formatMoney(c.appearance_fee, settings.currency)} per appearance` : ""}</p>
                    <div className="flex flex-wrap gap-2">
                      <ActionForm action={releaseWrestlerAction} submitLabel="Release" submitVariant="secondary" submitSize="sm" confirm={`Release ${w.ring_name} from ${promo?.name}?`} className="space-y-2">
                        {hidden}
                        <input type="hidden" name="promotionId" value={c.promotion_id} />
                      </ActionForm>
                    </div>
                    {others.length > 0 && (
                      <details className="rounded-lg border border-border p-3">
                        <summary className="cursor-pointer text-sm font-medium">Transfer to another promotion</summary>
                        <ActionForm action={transferWrestlerAction} submitLabel="Transfer" submitSize="sm" className="mt-3">
                          {hidden}
                          <input type="hidden" name="fromPromotionId" value={c.promotion_id} />
                          <ContractFields promotions={others} financesEnabled={settings.financesEnabled} />
                        </ActionForm>
                      </details>
                    )}
                  </div>
                );
              })}
              {unsigned.length > 0 && w.career_status !== "retired" && (
                <details className="p-4" open={contracts.length === 0}>
                  <summary className="cursor-pointer text-sm font-medium text-accent">Sign a contract</summary>
                  <ActionForm action={signContractAction} submitLabel="Sign contract" submitSize="sm" className="mt-3">
                    {hidden}
                    <ContractFields promotions={unsigned} financesEnabled={settings.financesEnabled} />
                  </ActionForm>
                </details>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Health" />
            <div className="space-y-3 p-4">
              {injury ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-danger">{injury.description}{injury.is_storyline ? " (storyline)" : ""}</p>
                    <p className="text-xs text-muted">{INJURY_SEVERITY_LABELS[injury.severity]} · expected back {formatGameDate(injury.expected_return_on)}</p>
                  </div>
                  <form action={healInjuryAction}>
                    {hidden}
                    <input type="hidden" name="injuryId" value={injury.id} />
                    <Button size="sm" variant="secondary">Mark healed</Button>
                  </form>
                </div>
              ) : (
                <p className="text-sm text-muted">{settings.injuriesEnabled ? "Fit to compete." : "Fit to compete. Random injuries are turned off in settings."}</p>
              )}
              {!injury && (
                <details>
                  <summary className="cursor-pointer text-sm font-medium">Add an injury (real or storyline)</summary>
                  <ActionForm action={addInjuryAction} submitLabel="Record injury" submitSize="sm" className="mt-3">
                    {hidden}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <Field label="Description" htmlFor="inj-desc" className="sm:col-span-3"><Input id="inj-desc" name="description" required maxLength={120} placeholder="e.g. Separated shoulder" /></Field>
                      <Field label="Severity" htmlFor="inj-sev">
                        <Select id="inj-sev" name="severity" defaultValue="moderate">{INJURY_SEVERITIES.map((s) => <option key={s} value={s}>{INJURY_SEVERITY_LABELS[s]}</option>)}</Select>
                      </Field>
                      <Field label="Weeks out" htmlFor="inj-weeks"><Input id="inj-weeks" name="weeks" type="number" min={1} max={104} defaultValue={4} /></Field>
                    </div>
                    <Checkbox name="is_storyline" label="Storyline injury" hint="Kayfabe only: no ability loss, but they still can't be booked to wrestle." />
                  </ActionForm>
                </details>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Teams & factions" action={<Link href={`${base}/teams`} className="text-xs text-accent">Manage</Link>} />
            {teams.length === 0 ? <p className="p-4 text-sm text-muted">Not part of a team.</p> : (
              <ul className="divide-y divide-border">
                {teams.map((t) => (
                  <li key={t.id}><Link href={`${base}/teams/${t.id}`} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-surface-2"><span className="font-medium">{t.name}</span><Badge>{TEAM_KIND_LABELS[t.kind]}</Badge></Link></li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader title="Championship history" />
          {reignHistory.length === 0 ? <p className="p-4 text-sm text-muted">No championship reigns yet.</p> : (
            <ul className="divide-y divide-border">
              {reignHistory.map((r) => (
                <li key={r.reign.id}>
                  <Link href={`${base}/championships/${r.championship.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                    <ChampionshipArt name={r.championship.name} assetId={r.championship.image_asset_id} tier={r.championship.tier} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className={cx("truncate text-sm font-medium", !r.reign.ended_on && "text-gold")}>{r.championship.name}</p>
                      <p className="text-xs text-muted">{formatGameDate(r.reign.started_on)} – {r.reign.ended_on ? formatGameDate(r.reign.ended_on) : "present"} · {r.days} days · {r.reign.defenses} defenses</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Storylines & rivalries" />
          <ul className="divide-y divide-border">
            {storylines.map((s) => (
              <li key={s.id}><Link href={`${base}/storylines/${s.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-surface-2"><span className="truncate font-medium">{s.title}</span><Badge tone={s.status === "resolved" ? "neutral" : "rivalry"}>{STORYLINE_STATUS_LABELS[s.status]}</Badge></Link></li>
            ))}
            {rivalries.map((r) => {
              const other = wrestlers.get(r.wrestler_a === w.id ? r.wrestler_b : r.wrestler_a);
              return (
                <li key={r.id}><Link href={`${base}/roster/${other?.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-surface-2"><span className="truncate">Rivalry with <span className="font-medium">{other?.ring_name}</span></span><span className="text-xs font-semibold text-rivalry">{r.intensity}</span></Link></li>
              );
            })}
            {storylines.length === 0 && rivalries.length === 0 && <li className="p-4 text-sm text-muted">Not involved in any storylines.</li>}
          </ul>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Recent matches" subtitle="Last 120 days" />
          {matches.length === 0 ? <p className="p-4 text-sm text-muted">No recent matches.</p> : (
            <ul className="divide-y divide-border">
              {matches.map(({ p, seg, show, others, result }) => (
                <li key={p.id}>
                  <Link href={`${base}/booking/${show!.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-2">
                    <Badge tone={p.outcome === "win" ? "success" : p.outcome === "loss" ? "danger" : "neutral"} className="w-12 justify-center">{p.outcome === "win" ? "W" : p.outcome === "loss" ? "L" : p.outcome === "draw" ? "D" : "NC"}</Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate">vs. {others.join(", ") || "—"}{seg!.championship_id ? " (title match)" : ""}</p>
                      <p className="truncate text-xs text-muted">{show!.name} · {formatGameDate(show!.show_date)}{result?.finish ? ` · ${FINISH_LABELS[result.finish as Finish] ?? result.finish}` : ""}</p>
                    </div>
                    {result && <Stars value={result.star_rating} />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {chemistry.length > 0 && (
          <Card>
            <CardHeader title="Chemistry" />
            <ul className="divide-y divide-border">
              {chemistry.map((c) => (
                <li key={c.other!.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
                  <Link href={`${base}/roster/${c.other!.id}`} className="truncate font-medium hover:underline">{c.other!.ring_name}</Link>
                  <span className="shrink-0 text-xs text-muted">
                    as partners <span className={c.partner >= 0 ? "text-success" : "text-danger"}>{c.partner > 0 ? "+" : ""}{c.partner}</span> · as opponents <span className={c.opponent >= 0 ? "text-success" : "text-danger"}>{c.opponent > 0 ? "+" : ""}{c.opponent}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card className={chemistry.length > 0 ? "" : "lg:col-span-2"}>
          <CardHeader title="Career timeline" />
          <ul className="divide-y divide-border">
            {timeline.map((e) => (
              <li key={e.id} className="flex gap-3 px-4 py-2 text-sm">
                <span className="w-20 shrink-0 text-xs text-muted">{formatGameDate(e.occurred_on)}</span>
                <span className="min-w-0">{e.title}</span>
              </li>
            ))}
            {timeline.length === 0 && <li className="p-4 text-sm text-muted">No events yet.</li>}
          </ul>
        </Card>

        {w.biography && (
          <Card className="lg:col-span-2">
            <CardHeader title="Biography" />
            <p className="whitespace-pre-line p-4 text-sm">{w.biography}</p>
          </Card>
        )}

        <Card className="lg:col-span-2">
          <CardHeader title="Career management" />
          <div className="flex flex-wrap gap-2 p-4">
            {w.career_status !== "retired" && (
              <ActionForm action={retireWrestlerAction} submitLabel="Retire wrestler" submitVariant="secondary" submitSize="sm" confirm={`Retire ${w.ring_name}? Their contracts end today. You can un-retire them later by editing their career status.`}>
                {hidden}
              </ActionForm>
            )}
            <form action={setWrestlerArchivedAction}>
              {hidden}
              <input type="hidden" name="archive" value={w.archived_at ? "false" : "true"} />
              <Button size="sm" variant="ghost">{w.archived_at ? "Restore from archive" : "Archive (hide from lists)"}</Button>
            </form>
          </div>
        </Card>
      </div>
    </>
  );
}
