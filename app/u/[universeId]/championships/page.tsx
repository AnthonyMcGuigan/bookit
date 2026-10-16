import type { Metadata } from "next";
import Link from "next/link";
import { getUniverseState } from "@/lib/game/load";
import { currentChampions } from "@/lib/domain/selectors";
import { CHAMPIONSHIP_TIER_LABELS } from "@/lib/domain/enums";
import { Badge, EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { ChampionshipArt } from "@/components/artwork";

export const metadata: Metadata = { title: "Championships" };

export default async function ChampionshipsPage({ params }: { params: Promise<{ universeId: string }> }) {
  const { universeId } = await params;
  const state = await getUniverseState(universeId);
  const base = `/u/${universeId}`;
  const current = new Map(currentChampions(state).map((c) => [c.championship.id, c.reign]));
  const promotions = state.promotions.filter((p) => !p.archived_at).sort((a, b) => (a.controlled_by === b.controlled_by ? 0 : a.controlled_by === "player" ? -1 : 1));
  const retired = state.championships.filter((c) => c.status === "retired");
  return (
    <>
      <PageHeader title="Championships" actions={<LinkButton href={`${base}/championships/new`} size="sm">New championship</LinkButton>} />
      {state.championships.length === 0 && <EmptyState title="No championships yet" action={<LinkButton href={`${base}/championships/new`} size="sm">Create one</LinkButton>} />}
      {promotions.map((p) => {
        const titles = state.championships.filter((c) => c.promotion_id === p.id && c.status === "active");
        if (titles.length === 0) return null;
        return (
          <section key={p.id}>
            <SectionTitle>{p.name}</SectionTitle>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {titles.map((c) => {
                const reign = current.get(c.id);
                return (
                  <li key={c.id}>
                    <Link href={`${base}/championships/${c.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 hover:bg-surface-2">
                      <ChampionshipArt name={c.name} assetId={c.image_asset_id} tier={c.tier} size={52} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{c.name}</p>
                        <p className={reign ? "truncate font-semibold text-gold" : "font-semibold text-muted"}>{reign ? reign.holders.map((h) => h.ring_name).join(" & ") : "Vacant"}</p>
                        <p className="text-xs text-muted">{CHAMPIONSHIP_TIER_LABELS[c.tier]} · prestige {c.prestige}{reign ? ` · ${reign.days} days · ${reign.reign.defenses} defenses` : ""}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {retired.length > 0 && (
        <section>
          <SectionTitle>Retired</SectionTitle>
          <ul className="flex flex-wrap gap-2">
            {retired.map((c) => <li key={c.id}><Link href={`${base}/championships/${c.id}`}><Badge>{c.name}</Badge></Link></li>)}
          </ul>
        </section>
      )}
    </>
  );
}
