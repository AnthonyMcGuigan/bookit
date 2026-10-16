import type { Metadata } from "next";
import Link from "next/link";
import { getUniverseState } from "@/lib/game/load";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { ActionForm } from "@/components/action-form";
import { Alert, Card, PageHeader } from "@/components/ui";
import { PublishFields, type PublishOptionGroup } from "@/features/community/publish-fields";
import { publishCreationAction } from "@/features/community/actions";

export const metadata: Metadata = { title: "Publish to community" };

export default async function PublishPage({ params }: { params: Promise<{ universeId: string }> }) {
  const { universeId } = await params;
  const user = await requireUser(`/u/${universeId}/community`);
  const state = await getUniverseState(universeId);
  const supabase = await createSupabaseServerClient();
  const [{ data: creations }, { data: restrictions }] = await Promise.all([
    supabase.from("community_creations").select("id, title, category, current_version, moderation_state").eq("owner_id", user.id).neq("moderation_state", "removed").order("updated_at", { ascending: false }),
    supabase.from("account_restrictions").select("kind, ends_at, lifted_at").eq("user_id", user.id).is("lifted_at", null),
  ]);
  const now = new Date().toISOString();
  const restricted = (restrictions ?? []).some((r) => !r.ends_at || r.ends_at > now);
  const sort = (rows: Array<[string, string]>) => rows.sort((a, b) => a[1].localeCompare(b[1]));
  const groups: PublishOptionGroup[] = (
    [
      { kind: "wrestler", items: sort(state.wrestlers.filter((w) => !w.archived_at).map((w) => [w.id, w.ring_name])) },
      { kind: "team", items: sort(state.teams.map((t) => [t.id, t.name])) },
      { kind: "championship", items: sort(state.championships.map((c) => [c.id, c.name])) },
      { kind: "promotion", items: sort(state.promotions.map((p) => [p.id, p.name])) },
      { kind: "storyline", items: sort(state.storylines.map((s) => [s.id, s.title])) },
      { kind: "venue", items: sort(state.venues.map((v) => [v.id, v.name])) },
    ] satisfies PublishOptionGroup[]
  ).filter((g) => g.items.length > 0);

  return (
    <>
      <PageHeader title="Publish to community" subtitle={`Share something from ${state.universe.name}. Your save isn't changed; players get their own copy.`} />
      <div className="mx-auto max-w-2xl space-y-4">
        {restricted ? (
          <Alert tone="danger" title="Publishing is unavailable">
            Your account currently can&apos;t publish. See <Link href="/account/moderation" className="underline">moderation notices</Link> for details and appeals.
          </Alert>
        ) : (
          <Card className="p-4 sm:p-6">
            <ActionForm action={publishCreationAction} submitLabel="Publish" pendingLabel="Publishing…" testId="publish-form">
              <input type="hidden" name="universeId" value={universeId} />
              <PublishFields groups={groups} creations={creations ?? []} />
            </ActionForm>
          </Card>
        )}
        <p className="text-xs text-muted">
          Manage what you&apos;ve shared in <Link href="/community/mine" className="text-accent">My creations</Link>.
        </p>
      </div>
    </>
  );
}
