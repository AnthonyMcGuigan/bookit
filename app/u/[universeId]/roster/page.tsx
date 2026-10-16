import type { Metadata } from "next";
import Link from "next/link";
import { getUniverseState, getWrestlerRecords } from "@/lib/game/load";
import { activeInjuries, currentChampions, freeAgents, indexById, playerPromotions, rosterOf } from "@/lib/domain/selectors";
import { ALIGNMENT_LABELS, CARD_POSITION_LABELS, DIVISION_LABELS, DIVISIONS, ALIGNMENTS } from "@/lib/domain/enums";
import type { Wrestler } from "@/lib/domain/entities";
import { Badge, Button, EmptyState, Input, LinkButton, PageHeader, Select, cx } from "@/components/ui";
import { WrestlerAvatar } from "@/components/artwork";

export const metadata: Metadata = { title: "Roster" };

const SORTS = {
  name: { label: "Name", fn: (a: Wrestler, b: Wrestler) => a.ring_name.localeCompare(b.ring_name) },
  popularity: { label: "Popularity", fn: (a: Wrestler, b: Wrestler) => b.popularity - a.popularity },
  momentum: { label: "Momentum", fn: (a: Wrestler, b: Wrestler) => b.momentum - a.momentum },
  in_ring: { label: "In-ring", fn: (a: Wrestler, b: Wrestler) => b.in_ring - a.in_ring },
  mic_skills: { label: "Mic skills", fn: (a: Wrestler, b: Wrestler) => b.mic_skills - a.mic_skills },
  morale: { label: "Morale", fn: (a: Wrestler, b: Wrestler) => a.morale - b.morale },
  fatigue: { label: "Fatigue", fn: (a: Wrestler, b: Wrestler) => b.fatigue - a.fatigue },
} as const;
type SortKey = keyof typeof SORTS;

type Search = { q?: string; group?: string; division?: string; alignment?: string; status?: string; sort?: string };

export default async function RosterPage({ params, searchParams }: { params: Promise<{ universeId: string }>; searchParams: Promise<Search> }) {
  const { universeId } = await params;
  const sp = await searchParams;
  const [state, records] = await Promise.all([getUniverseState(universeId), getWrestlerRecords(universeId)]);
  const base = `/u/${universeId}`;
  const promotions = state.promotions.filter((p) => !p.archived_at);
  const defaultGroup = playerPromotions(state)[0]?.id ?? "all";
  const group = sp.group ?? defaultGroup;
  const status = sp.status ?? "active";
  const sort: SortKey = sp.sort && sp.sort in SORTS ? (sp.sort as SortKey) : "popularity";

  let list: Wrestler[];
  if (group === "free") list = freeAgents(state);
  else if (group === "all") list = state.wrestlers;
  else list = rosterOf(state, group);
  if (status === "archived") list = state.wrestlers.filter((w) => w.archived_at);
  else {
    list = list.filter((w) => !w.archived_at);
    if (status !== "all") list = list.filter((w) => w.career_status === status);
  }
  if (sp.division && (DIVISIONS as readonly string[]).includes(sp.division)) list = list.filter((w) => w.division === sp.division);
  if (sp.alignment && (ALIGNMENTS as readonly string[]).includes(sp.alignment)) list = list.filter((w) => w.alignment === sp.alignment);
  const q = sp.q?.trim().toLowerCase();
  if (q) list = list.filter((w) => [w.ring_name, w.real_name, w.alternate_name, w.billed_from].some((v) => v.toLowerCase().includes(q)));
  list = list.slice().sort(SORTS[sort].fn);

  const injured = new Set(activeInjuries(state).map((i) => i.wrestler_id));
  const champs = new Map<string, string[]>();
  for (const { championship, reign } of currentChampions(state)) {
    for (const h of reign?.holders ?? []) champs.set(h.id, [...(champs.get(h.id) ?? []), championship.name]);
  }
  const memberships = new Map<string, string[]>();
  const promoById = indexById(state.promotions);
  for (const m of state.rosterMemberships) {
    if (m.ended_on !== null) continue;
    memberships.set(m.wrestler_id, [...(memberships.get(m.wrestler_id) ?? []), promoById.get(m.promotion_id)?.abbreviation ?? "?"]);
  }

  const groups = [
    ...promotions.map((p) => ({ id: p.id, label: p.abbreviation, count: rosterOf(state, p.id).filter((w) => w.career_status === "active").length })),
    { id: "free", label: "Free agents", count: freeAgents(state).length },
    { id: "all", label: "Everyone", count: state.wrestlers.filter((w) => !w.archived_at).length },
  ];
  const link = (patch: Partial<Search>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, group, ...patch })) if (v) next.set(k, v);
    return `${base}/roster?${next.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Roster"
        subtitle={`${list.length} shown`}
        actions={
          <>
            <LinkButton href={`${base}/teams`} variant="secondary" size="sm">Teams & factions</LinkButton>
            <LinkButton href={`${base}/roster/new`} size="sm">New wrestler</LinkButton>
          </>
        }
      />
      <nav aria-label="Roster groups" className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {groups.map((g) => (
          <Link
            key={g.id}
            href={link({ group: g.id })}
            aria-current={group === g.id ? "page" : undefined}
            className={cx("shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium", group === g.id ? "border-accent bg-accent text-accent-contrast" : "border-border bg-surface hover:bg-surface-2")}
          >
            {g.label} <span className="opacity-70">{g.count}</span>
          </Link>
        ))}
      </nav>
      <form method="get" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-6" role="search">
        <input type="hidden" name="group" value={group} />
        <Input name="q" defaultValue={sp.q} placeholder="Search names" aria-label="Search names" className="col-span-2" />
        <Select name="division" defaultValue={sp.division ?? ""} aria-label="Division">
          <option value="">All divisions</option>
          {DIVISIONS.map((d) => <option key={d} value={d}>{DIVISION_LABELS[d]}</option>)}
        </Select>
        <Select name="alignment" defaultValue={sp.alignment ?? ""} aria-label="Alignment">
          <option value="">Any alignment</option>
          {ALIGNMENTS.map((a) => <option key={a} value={a}>{ALIGNMENT_LABELS[a]}</option>)}
        </Select>
        <Select name="status" defaultValue={status} aria-label="Status">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="retired">Retired</option>
          <option value="all">Any status</option>
          <option value="archived">Archived</option>
        </Select>
        <Select name="sort" defaultValue={sort} aria-label="Sort by">
          {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>Sort: {v.label}</option>)}
        </Select>
        <Button type="submit" variant="secondary" className="col-span-2 sm:col-span-6 sm:justify-self-start">Apply filters</Button>
      </form>

      {list.length === 0 ? (
        <EmptyState
          title={group === "free" ? "No free agents" : "No wrestlers match"}
          description="Adjust the filters or add someone new."
          action={<LinkButton href={`${base}/roster/new`} size="sm">New wrestler</LinkButton>}
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface" data-testid="roster-list">
          {list.map((w) => {
            const rec = records.get(w.id);
            return (
              <li key={w.id}>
                <Link href={`${base}/roster/${w.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-2 sm:px-4">
                  <WrestlerAvatar name={w.ring_name} assetId={w.portrait_asset_id} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate font-semibold">{w.ring_name}</span>
                      {champs.has(w.id) && <Badge tone="gold" title={champs.get(w.id)!.join(", ")}>Champion</Badge>}
                      {injured.has(w.id) && <Badge tone="danger">Injured</Badge>}
                      {w.career_status !== "active" && <Badge>{w.career_status}</Badge>}
                    </div>
                    <p className="truncate text-xs text-muted">
                      {ALIGNMENT_LABELS[w.alignment]} · {CARD_POSITION_LABELS[w.card_position]}
                      {group === "all" || group === "free" ? ` · ${(memberships.get(w.id) ?? ["Free agent"]).join(", ")}` : ""}
                      {rec ? ` · ${rec.wins}-${rec.losses}${rec.draws ? `-${rec.draws}` : ""}` : ""}
                    </p>
                  </div>
                  <dl className="grid shrink-0 grid-cols-2 gap-x-3 text-right text-xs sm:grid-cols-4">
                    <div><dt className="text-muted">Pop</dt><dd className="font-semibold tabular-nums">{w.popularity}</dd></div>
                    <div><dt className="text-muted">Mom</dt><dd className={cx("font-semibold tabular-nums", w.momentum > 0 ? "text-success" : w.momentum < 0 ? "text-danger" : "")}>{w.momentum > 0 ? "+" : ""}{w.momentum}</dd></div>
                    <div className="hidden sm:block"><dt className="text-muted">Ring</dt><dd className="font-semibold tabular-nums">{w.in_ring}</dd></div>
                    <div className="hidden sm:block"><dt className="text-muted">Morale</dt><dd className={cx("font-semibold tabular-nums", w.morale < 40 && "text-danger")}>{w.morale}</dd></div>
                  </dl>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
