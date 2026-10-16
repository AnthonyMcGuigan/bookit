import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/layout/site-header";
import { Alert, Badge, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getEntitlementSummary } from "@/lib/entitlements/service";
import { PACKAGE_KIND_LABELS, type PackageKind } from "@/lib/packages/schema";
import { MODERATION_LABELS, VISIBILITY_LABELS } from "@/features/community/constants";
import { averageRating } from "@/features/community/creation-card";
import { CREATION_LIST_COLUMNS } from "@/features/community/queries";

export const metadata: Metadata = { title: "My creations" };

export default async function MyCreationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams;
  const user = await requireUser("/community/mine");
  const supabase = await createSupabaseServerClient();
  const [{ data }, summary] = await Promise.all([
    supabase.from("community_creations").select(CREATION_LIST_COLUMNS).eq("owner_id", user.id).order("updated_at", { ascending: false }),
    getEntitlementSummary(supabase).catch(() => null),
  ]);
  const creations = data ?? [];
  const active = creations.filter((c) => c.visibility !== "draft" && c.moderation_state !== "removed").length;
  const tone = (state: string) => (state === "approved" ? "success" : state === "pending" ? "gold" : "danger") as "success" | "gold" | "danger";

  return (
    <SiteShell>
      <PageHeader
        title="My creations"
        subtitle={summary ? `${active} of ${summary.limits.published_creations} active creations (published or unlisted).` : undefined}
      />
      {query.deleted && <div className="mb-4"><Alert tone="success">Creation deleted. Players who already imported it keep their copies.</Alert></div>}
      {creations.length === 0 ? (
        <EmptyState
          title="You haven't shared anything yet"
          description={<>Open a universe and choose <span className="font-medium">More → Export &amp; share → Publish to community</span>.</>}
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface" data-testid="my-creations">
          {creations.map((c) => {
            const avg = averageRating(c);
            return (
              <li key={c.id}>
                <Link href={`/community/${c.id}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-surface-2 sm:flex-row sm:items-center sm:gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.title}</span>
                    <span className="block text-xs text-muted">
                      {PACKAGE_KIND_LABELS[c.category as PackageKind]} · v{c.current_version} · {avg !== null ? `★ ${avg.toFixed(1)}` : "no ratings"} · {c.download_count} download(s)
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    <Badge>{VISIBILITY_LABELS[c.visibility]}</Badge>
                    <Badge tone={tone(c.moderation_state)}>{MODERATION_LABELS[c.moderation_state]}</Badge>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-4 text-xs text-muted">
        Moderation decisions and appeals are listed under <Link href="/account/moderation" className="text-accent">Account → Moderation</Link>.
      </p>
    </SiteShell>
  );
}
