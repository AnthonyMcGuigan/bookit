import type { Metadata } from "next";
import Link from "next/link";
import { getUniverseState } from "@/lib/game/load";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getEntitlementSummary } from "@/lib/entitlements/service";
import { playerPromotions } from "@/lib/domain/selectors";
import { MATCH_TYPE_LABELS } from "@/lib/domain/enums";
import { computeAnalytics } from "@/lib/analytics/compute";
import { Alert, Card, CardHeader, EmptyState, PageHeader, Stat } from "@/components/ui";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage({ params }: { params: Promise<{ universeId: string }> }) {
  const { universeId } = await params;
  const supabase = await createSupabaseServerClient();
  // Server-side check against database entitlements; never a client flag.
  const summary = await getEntitlementSummary(supabase).catch(() => null);
  const base = `/u/${universeId}`;
  if (!summary?.limits.advanced_analytics) {
    return (
      <>
        <PageHeader title="Analytics" />
        <Alert tone="gold" title="Advanced analytics is a Premium feature">
          Rating trends, performer rankings and roster usage insights are part of Premium. Everything else, including booking, simulation, history and your saves, stays fully available on the free plan.{" "}
          <Link href="/account" className="underline">See plans</Link>
        </Alert>
        <p className="mt-4 text-sm text-muted">
          Your show ratings and results are always on the <Link href={`${base}/history`} className="text-accent">History</Link> page.
        </p>
      </>
    );
  }
  const state = await getUniverseState(universeId);
  const ids = new Set(playerPromotions(state).map((p) => p.id));
  const a = computeAnalytics(state, ids);
  const maxRating = Math.max(5, ...a.showTrend.map((s) => s.rating));
  return (
    <>
      <PageHeader title="Analytics" subtitle="Your promotions over the last 120 game days." />
      {a.showTrend.length === 0 ? (
        <EmptyState title="No completed shows yet" description="Simulate a show to start building analytics." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" data-testid="analytics">
          <Card className="lg:col-span-2">
            <CardHeader title="Show ratings" subtitle={`Last ${a.showTrend.length} shows`} />
            <div className="flex h-40 items-end gap-1 overflow-x-auto p-4" role="img" aria-label="Show rating trend">
              {a.showTrend.map((s) => (
                <Link key={s.showId} href={`${base}/booking/${s.showId}`} title={`${s.name}: ${s.rating.toFixed(2)}`} className="flex h-full min-w-4 flex-1 flex-col justify-end">
                  <span className="block rounded-t bg-accent" style={{ height: `${(s.rating / maxRating) * 100}%` }} />
                </Link>
              ))}
            </div>
          </Card>
          <div className="grid grid-cols-2 gap-3 lg:col-span-2">
            <Stat label="Matches" value={a.segmentShare.matches} hint={`avg ${a.segmentShare.avgMatchStars.toFixed(2)}★`} />
            <Stat label="Promos & angles" value={a.segmentShare.promos} hint={`avg ${a.segmentShare.avgPromoStars.toFixed(2)}★`} />
          </div>
          <Card>
            <CardHeader title="Best performers" subtitle="Average match rating, 2+ matches" />
            <ol className="divide-y divide-border text-sm">
              {a.performers.map((p, i) => (
                <li key={p.wrestlerId} className="flex items-center gap-3 px-4 py-2">
                  <span className="w-5 text-muted">{i + 1}</span>
                  <Link href={`${base}/roster/${p.wrestlerId}`} className="min-w-0 flex-1 truncate">{p.name}</Link>
                  <span className="text-xs text-muted">{p.matches} m · {p.wins} W</span>
                  <span className="w-12 text-right font-semibold text-gold">{p.avgStars.toFixed(2)}</span>
                </li>
              ))}
              {a.performers.length === 0 && <li className="p-4 text-muted">Not enough matches yet.</li>}
            </ol>
          </Card>
          <Card>
            <CardHeader title="Match types" />
            <ul className="divide-y divide-border text-sm">
              {a.matchTypes.map((t) => (
                <li key={t.matchType} className="flex justify-between px-4 py-2">
                  <span>{MATCH_TYPE_LABELS[t.matchType as keyof typeof MATCH_TYPE_LABELS] ?? t.matchType}</span>
                  <span className="text-muted">{t.count} · {t.avgStars.toFixed(2)}★</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Possibly overexposed" subtitle="Far more matches than the roster average" />
            <ul className="divide-y divide-border text-sm">
              {a.overexposed.map((p) => <li key={p.wrestlerId} className="flex justify-between px-4 py-2"><span>{p.name}</span><span className="text-muted">{p.matches} matches</span></li>)}
              {a.overexposed.length === 0 && <li className="p-4 text-muted">Nobody stands out.</li>}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Unused talent" subtitle="On your roster with no matches in this period" />
            <ul className="divide-y divide-border text-sm">
              {a.underused.map((w) => <li key={w.wrestlerId} className="flex justify-between px-4 py-2"><Link href={`${base}/roster/${w.wrestlerId}`}>{w.name}</Link><span className="text-muted">popularity {w.popularity}</span></li>)}
              {a.underused.length === 0 && <li className="p-4 text-muted">Everyone has been used.</li>}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
