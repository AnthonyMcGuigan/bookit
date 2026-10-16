import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUniverseState } from "@/lib/game/load";
import { completedShows, currentChampions, rosterOf } from "@/lib/domain/selectors";
import { formatGameDate } from "@/lib/domain/dates";
import { Button, Card, CardHeader, PageHeader, Stat, formatMoney } from "@/components/ui";
import { PromotionLogo, WrestlerAvatar } from "@/components/artwork";
import { ActionForm } from "@/components/action-form";
import { savePromotionAction, setPromotionArchivedAction } from "@/features/promotions/actions";
import { PromotionFields } from "@/features/promotions/promotion-fields";

export const metadata: Metadata = { title: "Promotion" };

export default async function PromotionPage({ params }: { params: Promise<{ universeId: string; promotionId: string }> }) {
  const { universeId, promotionId } = await params;
  const state = await getUniverseState(universeId);
  const p = state.promotions.find((x) => x.id === promotionId);
  if (!p) notFound();
  const base = `/u/${universeId}`;
  const settings = state.universe.settings;
  const roster = rosterOf(state, p.id).sort((a, b) => b.popularity - a.popularity);
  const champions = currentChampions(state).filter((c) => c.championship.promotion_id === p.id);
  const shows = completedShows(state).filter((s) => s.promotion_id === p.id);
  const avg = shows.length ? shows.reduce((t, s) => t + (s.rating ?? 0), 0) / shows.length : null;
  return (
    <>
      <PageHeader
        back={{ href: `${base}/promotions`, label: "Promotions" }}
        title={<span className="flex items-center gap-3"><PromotionLogo name={p.name} abbreviation={p.abbreviation} primary={p.primary_color} secondary={p.secondary_color} assetId={p.logo_asset_id} size={48} /><span className="truncate">{p.name}</span></span>}
        subtitle={p.tagline || undefined}
      />
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Popularity" value={p.popularity} />
        <Stat label="Reputation" value={p.reputation} />
        <Stat label="Roster" value={roster.length} />
        {settings.financesEnabled ? <Stat label="Cash" value={formatMoney(p.cash_balance, settings.currency)} /> : <Stat label="Avg. rating (120d)" value={avg?.toFixed(2) ?? "—"} />}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Roster" action={<Link className="text-xs text-accent" href={`${base}/roster?group=${p.id}`}>Full roster</Link>} />
          <ul className="divide-y divide-border">
            {roster.slice(0, 10).map((w) => (
              <li key={w.id}><Link href={`${base}/roster/${w.id}`} className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-surface-2"><WrestlerAvatar name={w.ring_name} assetId={w.portrait_asset_id} size={28} /><span className="flex-1 truncate">{w.ring_name}</span><span className="text-xs text-muted">{w.popularity}</span></Link></li>
            ))}
            {roster.length === 0 && <li className="p-4 text-sm text-muted">Nobody is signed yet. Sign free agents from the roster page.</li>}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Champions" />
          <ul className="divide-y divide-border">
            {champions.map(({ championship, reign }) => (
              <li key={championship.id}><Link href={`${base}/championships/${championship.id}`} className="flex justify-between gap-2 px-4 py-2 text-sm hover:bg-surface-2"><span className="truncate">{championship.name}</span><span className="truncate font-medium text-gold">{reign ? reign.holders.map((h) => h.ring_name).join(" & ") : "Vacant"}</span></Link></li>
            ))}
            {champions.length === 0 && <li className="p-4 text-sm text-muted">No championships.</li>}
          </ul>
          {shows[0] && <p className="border-t border-border px-4 py-2 text-xs text-muted">Last show: {shows[0].name}, {formatGameDate(shows[0].show_date)} ({shows[0].rating?.toFixed(2)})</p>}
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Edit promotion" subtitle="Custom logos can be uploaded once image uploads are enabled for your account." />
          <div className="p-4">
            <ActionForm action={savePromotionAction} submitLabel="Save promotion">
              <input type="hidden" name="universeId" value={universeId} />
              <input type="hidden" name="promotionId" value={p.id} />
              <PromotionFields promotion={p} />
            </ActionForm>
          </div>
        </Card>
        <form action={setPromotionArchivedAction}>
          <input type="hidden" name="universeId" value={universeId} />
          <input type="hidden" name="promotionId" value={p.id} />
          <input type="hidden" name="archive" value={p.archived_at ? "false" : "true"} />
          <Button variant="ghost" size="sm">{p.archived_at ? "Restore promotion" : "Archive promotion"}</Button>
        </form>
      </div>
    </>
  );
}
