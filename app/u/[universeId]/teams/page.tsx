import type { Metadata } from "next";
import Link from "next/link";
import { getUniverseState } from "@/lib/game/load";
import { indexById, teamMembers } from "@/lib/domain/selectors";
import { TEAM_KIND_LABELS } from "@/lib/domain/enums";
import { Badge, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { TeamLogo } from "@/components/artwork";

export const metadata: Metadata = { title: "Teams & factions" };

export default async function TeamsPage({ params }: { params: Promise<{ universeId: string }> }) {
  const { universeId } = await params;
  const state = await getUniverseState(universeId);
  const base = `/u/${universeId}`;
  const promos = indexById(state.promotions);
  const teams = state.teams.filter((t) => !t.archived_at).sort((a, b) => Number(!!a.disbanded_on) - Number(!!b.disbanded_on) || a.name.localeCompare(b.name));
  return (
    <>
      <PageHeader title="Teams & factions" back={{ href: `${base}/roster`, label: "Roster" }} actions={<LinkButton href={`${base}/teams/new`} size="sm">New team</LinkButton>} />
      {teams.length === 0 ? (
        <EmptyState title="No teams yet" description="Pair wrestlers into tag teams and trios, or build a faction." action={<LinkButton href={`${base}/teams/new`} size="sm">Create a team</LinkButton>} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {teams.map((t) => {
            const members = teamMembers(state, t.id);
            return (
              <li key={t.id}>
                <Link href={`${base}/teams/${t.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 hover:bg-surface-2">
                  <TeamLogo name={t.name} assetId={t.logo_asset_id} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate font-semibold">{t.name}</span>
                      <Badge>{TEAM_KIND_LABELS[t.kind]}</Badge>
                      {t.disbanded_on && <Badge tone="danger">Disbanded</Badge>}
                    </div>
                    <p className="truncate text-xs text-muted">{members.map((m) => m.wrestler.ring_name).join(", ") || "No current members"}</p>
                    <p className="text-xs text-muted">{t.promotion_id ? promos.get(t.promotion_id)?.abbreviation : "Independent"} · experience {t.experience}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
