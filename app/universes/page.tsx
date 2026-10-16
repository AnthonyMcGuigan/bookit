import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/layout/site-header";
import { Alert, Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listUniverses } from "@/lib/storage/universe-repo";
import { formatGameDate } from "@/lib/domain/dates";
import { CreateUniverseForm } from "@/features/universes/create-universe-form";
import { SettingsFields } from "@/features/universes/settings-fields";
import { archiveUniverseAction } from "@/features/universes/actions";
import { getEntitlementSummary } from "@/lib/entitlements/service";
import { errorMessage } from "@/lib/errors";

export const metadata: Metadata = { title: "Your universes" };

export default async function UniversesPage() {
  const user = await requireUser("/universes");
  const supabase = await createSupabaseServerClient();
  let universes: Awaited<ReturnType<typeof listUniverses>> = [];
  let loadError: string | null = null;
  try {
    universes = await listUniverses(supabase);
  } catch (e) {
    loadError = errorMessage(e);
  }
  const entitlements = await getEntitlementSummary(supabase, user.id).catch(() => null);
  const slots = entitlements?.limits.universe_slots ?? 3;
  const active = universes.filter((u) => !u.archived_at);
  const archived = universes.filter((u) => u.archived_at);
  const atLimit = universes.length >= slots;

  return (
    <SiteShell>
      <PageHeader title="Your universes" subtitle={`${universes.length} of ${slots} cloud save slots used${entitlements?.plan === "premium" ? " (Premium)" : ""}.`} />
      {loadError && <div className="mb-4"><Alert tone="danger" title="Couldn't load your saves">{loadError}</Alert></div>}
      {!user.emailConfirmed && <div className="mb-4"><Alert tone="gold">Your email address is not confirmed yet.</Alert></div>}

      {active.length === 0 && !loadError ? (
        <EmptyState title="No universes yet" description="Create your first universe below. The starter universe is the quickest way to start booking." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((u) => (
            <Card key={u.id} className="flex flex-col p-4">
              <Link href={`/u/${u.id}`} className="group">
                <div className="flex items-center gap-2">
                  <h2 className="truncate font-semibold group-hover:text-accent">{u.name}</h2>
                  {u.origin === "starter" && <Badge>Starter</Badge>}
                  {u.origin === "community_import" && <Badge tone="upcoming">Community</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted">Game date {formatGameDate(u.game_date)}</p>
                <p className="text-sm text-muted">{u.promotionCount} promotion(s) · {u.wrestlerCount} wrestlers</p>
              </Link>
              <div className="mt-4 flex items-center gap-2">
                <Link href={`/u/${u.id}`} className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-contrast">Continue</Link>
                <form action={archiveUniverseAction}>
                  <input type="hidden" name="universeId" value={u.id} />
                  <input type="hidden" name="archive" value="true" />
                  <button className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2">Archive</button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-medium text-muted">Archived universes ({archived.length})</summary>
          <ul className="mt-2 space-y-2">
            {archived.map((u) => (
              <li key={u.id} className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                <Link href={`/u/${u.id}`}>{u.name}</Link>
                <form action={archiveUniverseAction}>
                  <input type="hidden" name="universeId" value={u.id} />
                  <input type="hidden" name="archive" value="false" />
                  <button className="text-accent">Restore</button>
                </form>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Card className="mt-8 p-4 sm:p-6">
        <h2 className="mb-1 text-lg font-semibold">Create a universe</h2>
        <p className="mb-4 text-sm text-muted">
          You can also <Link href="/community?category=universe" className="text-accent">import a community universe</Link> or{" "}
          <Link href="/universes/import" className="text-accent">import a package file</Link>.
        </p>
        {atLimit ? (
          <Alert tone="gold" title="All save slots are in use">
            Archived universes still count toward your limit. Delete a universe from its settings page{entitlements?.plan === "free" ? ", or upgrade for more slots" : ""}. Your existing saves are never locked.
          </Alert>
        ) : (
          <CreateUniverseForm idempotencyKey={crypto.randomUUID()} settingsFields={<SettingsFields />} defaultDate={new Date().toISOString().slice(0, 10)} />
        )}
      </Card>
    </SiteShell>
  );
}
