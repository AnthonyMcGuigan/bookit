import Link from "next/link";
import { UniverseNav } from "@/components/universe/nav";
import { PromotionLogo } from "@/components/artwork";
import { getUniverseHeader } from "@/lib/game/load";
import { formatGameDate } from "@/lib/domain/dates";

export default async function UniverseLayout({ children, params }: { children: React.ReactNode; params: Promise<{ universeId: string }> }) {
  const { universeId } = await params;
  const universe = await getUniverseHeader(universeId);
  const promotions = (universe.promotions ?? []).filter((p) => !p.archived_at);
  const primary = promotions.find((p) => p.controlled_by === "player") ?? promotions[0];
  const style = primary ? ({ "--accent": primary.primary_color } as React.CSSProperties) : undefined;
  return (
    <div style={style}>
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4">
          <Link href="/universes" className="text-sm text-muted hover:text-text" aria-label="All universes">‹</Link>
          {primary && <PromotionLogo name={primary.name} abbreviation={primary.abbreviation} primary={primary.primary_color} secondary={primary.secondary_color} assetId={primary.logo_asset_id} size={32} />}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{universe.name}</p>
            <p className="text-xs text-muted" data-testid="game-date">{formatGameDate(universe.game_date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</p>
          </div>
          <nav className="ml-auto flex items-center gap-1 text-sm" aria-label="Account">
            <Link href="/community" className="hidden rounded-lg px-3 py-2 hover:bg-surface-2 sm:block">Community</Link>
            <Link href="/account" className="rounded-lg px-3 py-2 hover:bg-surface-2">Account</Link>
          </nav>
        </div>
      </header>
      <div className="flex">
        <UniverseNav universeId={universeId} />
        <main id="main" className="pb-safe min-w-0 flex-1 px-4 py-5 lg:px-8">
          {universe.archived_at && (
            <p className="mb-4 rounded-lg border border-gold/30 bg-gold-soft px-3 py-2 text-sm text-gold">This universe is archived. You can still play it; restore it from the universes page.</p>
          )}
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
