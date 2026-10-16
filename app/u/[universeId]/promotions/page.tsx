import type { Metadata } from "next";
import Link from "next/link";
import { getUniverseState } from "@/lib/game/load";
import { rosterOf } from "@/lib/domain/selectors";
import { AUDIENCE_PROFILE_LABELS } from "@/lib/domain/enums";
import { Badge, Card, CardHeader, PageHeader, formatMoney } from "@/components/ui";
import { PromotionLogo } from "@/components/artwork";
import { ActionForm } from "@/components/action-form";
import { savePromotionAction } from "@/features/promotions/actions";
import { PromotionFields } from "@/features/promotions/promotion-fields";

export const metadata: Metadata = { title: "Promotions" };

export default async function PromotionsPage({ params }: { params: Promise<{ universeId: string }> }) {
  const { universeId } = await params;
  const state = await getUniverseState(universeId);
  const base = `/u/${universeId}`;
  const settings = state.universe.settings;
  const sorted = state.promotions.slice().sort((a, b) => Number(!!a.archived_at) - Number(!!b.archived_at) || (a.controlled_by === b.controlled_by ? 0 : a.controlled_by === "player" ? -1 : 1));
  return (
    <>
      <PageHeader title="Promotions" back={{ href: `${base}/more`, label: "More" }} />
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {sorted.map((p) => (
          <li key={p.id}>
            <Link href={`${base}/promotions/${p.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 hover:bg-surface-2">
              <PromotionLogo name={p.name} abbreviation={p.abbreviation} primary={p.primary_color} secondary={p.secondary_color} assetId={p.logo_asset_id} size={52} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate font-semibold">{p.name}</span>
                  <Badge tone={p.controlled_by === "player" ? "accent" : "neutral"}>{p.controlled_by === "player" ? "Yours" : "AI"}</Badge>
                  {p.archived_at && <Badge>Archived</Badge>}
                </div>
                <p className="truncate text-xs text-muted">{AUDIENCE_PROFILE_LABELS[p.audience_profile]} · {p.region} · {rosterOf(state, p.id).length} signed</p>
                <p className="text-xs text-muted">Popularity {p.popularity} · Reputation {p.reputation}{settings.financesEnabled ? ` · ${formatMoney(p.cash_balance, settings.currency)}` : ""}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <Card className="mt-6">
        <CardHeader title="Create a promotion" />
        <div className="p-4">
          <ActionForm action={savePromotionAction} submitLabel="Create promotion" resetOnSuccess>
            <input type="hidden" name="universeId" value={universeId} />
            <PromotionFields />
          </ActionForm>
        </div>
      </Card>
    </>
  );
}
