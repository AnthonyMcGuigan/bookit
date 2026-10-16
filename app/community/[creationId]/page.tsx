import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/layout/site-header";
import { ActionForm } from "@/components/action-form";
import { Alert, Badge, Card, CardHeader, Field, LinkButton, PageHeader, Select, Textarea } from "@/components/ui";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PACKAGE_KIND_LABELS, type PackageKind } from "@/lib/packages/schema";
import { COLLECTION_LABELS } from "@/lib/packages/merge";
import type { UniverseCollectionKey } from "@/lib/domain/entities";
import { rateCreationAction, reportAction } from "@/features/community/actions";
import { MODERATION_LABELS, REPORT_CATEGORIES, VISIBILITY_LABELS } from "@/features/community/constants";
import { averageRating } from "@/features/community/creation-card";

export const metadata: Metadata = { title: "Community creation" };

const SHOWN_COUNTS: UniverseCollectionKey[] = ["promotions", "wrestlers", "teams", "championships", "storylines", "venues", "shows"];

export default async function CreationPage({ params, searchParams }: { params: Promise<{ creationId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { creationId } = await params;
  const query = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(creationId)) notFound();
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: creation } = await supabase.from("community_creations").select("*").eq("id", creationId).maybeSingle();
  if (!creation) notFound();
  const isOwner = auth.user?.id === creation.owner_id;
  const [{ data: versions }, { data: author }, { data: myRating }, { data: source }] = await Promise.all([
    supabase.from("creation_versions").select("version, changelog, entity_counts, package_bytes, created_at").eq("creation_id", creationId).order("version", { ascending: false }),
    supabase.from("profiles").select("handle, display_name").eq("id", creation.owner_id).maybeSingle(),
    auth.user ? supabase.from("creation_ratings").select("stars").eq("creation_id", creationId).eq("user_id", auth.user.id).maybeSingle() : Promise.resolve({ data: null }),
    creation.source_creation_id ? supabase.from("community_creations").select("id, title").eq("id", creation.source_creation_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const latest = versions?.[0];
  const counts = (latest?.entity_counts ?? {}) as Partial<Record<UniverseCollectionKey, number>>;
  const avg = averageRating(creation);
  const lineage = (creation.lineage as Array<{ creationId: string; title: string; author: string; version: number }>) ?? [];
  const isPublic = creation.moderation_state === "approved" && creation.visibility !== "draft";

  return (
    <SiteShell>
      <PageHeader
        title={creation.title}
        subtitle={
          <>
            {PACKAGE_KIND_LABELS[creation.category as PackageKind]} by{" "}
            {author ? <Link href={`/creators/${author.handle}`} className="text-accent">{author.display_name}</Link> : "a former member"}
          </>
        }
        actions={
          latest && (isPublic || isOwner) ? (
            <LinkButton href={`/universes/import?creation=${creation.id}`} size="sm" data-testid="import-creation">Import</LinkButton>
          ) : undefined
        }
      />
      <div className="space-y-3">
        {query.published && (
          <Alert tone={query.review ? "gold" : "success"} title={query.review ? "Submitted for review" : `Version ${query.published} published`}>
            {query.review ? "A moderator will review it before it appears in the library. You can still see it here." : "It's live in the community library."}
            {query.warnings ? ` ${query.warnings}` : ""}
          </Alert>
        )}
        {isOwner && creation.moderation_state !== "approved" && (
          <Alert tone={creation.moderation_state === "pending" ? "gold" : "danger"} title={MODERATION_LABELS[creation.moderation_state]}>
            {creation.moderation_reason ?? ""}{" "}
            {creation.moderation_state !== "pending" && <Link href="/account/moderation" className="underline">View notices and appeal</Link>}
          </Alert>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="overflow-hidden">
            {creation.thumbnail_asset_id && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/media/${creation.thumbnail_asset_id}?v=full`} alt="" className="aspect-[16/9] w-full bg-surface-2 object-cover" />
            )}
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="upcoming">{PACKAGE_KIND_LABELS[creation.category as PackageKind]}</Badge>
                {creation.is_fan_content && <Badge title="Inspired by real-world wrestling; not affiliated with or endorsed by any real person or company.">Fan content</Badge>}
                {isOwner && <Badge>{VISIBILITY_LABELS[creation.visibility]}</Badge>}
                {creation.allow_derivatives ? <Badge tone="success">Remixes allowed</Badge> : <Badge>No remixes</Badge>}
              </div>
              {creation.summary && <p className="font-medium">{creation.summary}</p>}
              {creation.description && <p className="whitespace-pre-line text-sm text-muted">{creation.description}</p>}
              {creation.tags.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {creation.tags.map((t) => (
                    <li key={t}><Link href={`/community?tag=${encodeURIComponent(t)}`} className="rounded-full bg-surface-2 px-2 py-1 text-xs">#{t}</Link></li>
                  ))}
                </ul>
              )}
              {creation.is_fan_content && (
                <p className="text-xs text-muted">Fan content: an unofficial, fictional tribute. Not affiliated with or endorsed by any real person, promotion or rights holder.</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="What's inside" subtitle={latest ? `Version ${latest.version} · ${(latest.package_bytes / 1024).toFixed(0)} KB` : undefined} />
            <ul className="flex flex-wrap gap-2 p-4 text-sm" data-testid="creation-contents">
              {SHOWN_COUNTS.filter((k) => counts[k]).map((k) => (
                <li key={k} className="rounded-lg bg-surface-2 px-3 py-1.5">{counts[k]} {COLLECTION_LABELS[k].toLowerCase()}</li>
              ))}
              {SHOWN_COUNTS.every((k) => !counts[k]) && <li className="text-muted">Details unavailable.</li>}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Versions" />
            <ul className="divide-y divide-border">
              {(versions ?? []).map((v) => (
                <li key={v.version} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    <span className="font-medium">Version {v.version}</span>
                    <span className="text-muted"> · {new Date(v.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    {v.changelog && <span className="block text-xs text-muted">{v.changelog}</span>}
                  </span>
                  {(isPublic || isOwner) && <Link href={`/universes/import?creation=${creation.id}&version=${v.version}`} className="text-xs text-accent">Import this version</Link>}
                </li>
              ))}
            </ul>
          </Card>

          {(source || lineage.length > 0) && (
            <Card>
              <CardHeader title="Based on" />
              <ul className="space-y-1 p-4 text-sm">
                {source && <li>Remix of <Link href={`/community/${source.id}`} className="text-accent">{source.title}</Link></li>}
                {lineage.filter((l) => l.creationId !== source?.id).map((l) => (
                  <li key={`${l.creationId}:${l.version}`} className="text-muted">{l.title} (v{l.version}) by {l.author}</li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Ratings & downloads" />
            <div className="space-y-3 p-4 text-sm">
              <p data-testid="creation-rating">
                <span className="text-2xl font-bold">{avg !== null ? avg.toFixed(1) : "–"}</span>
                <span className="text-muted"> / 5 from {creation.rating_count} rating(s)</span>
              </p>
              <p className="text-muted" data-testid="creation-downloads">{creation.download_count} download(s)</p>
              {auth.user && !isOwner && isPublic && (
                <ActionForm action={rateCreationAction} submitLabel={myRating ? "Update rating" : "Rate"} submitSize="sm" testId="rate-form">
                  <input type="hidden" name="creationId" value={creation.id} />
                  <Field label="Your rating" htmlFor="stars">
                    <Select id="stars" name="stars" defaultValue={myRating?.stars ?? 5}>
                      {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)} ({n})</option>)}
                    </Select>
                  </Field>
                </ActionForm>
              )}
              {!auth.user && <p><Link href={`/sign-in?next=/community/${creation.id}`} className="text-accent">Sign in</Link> to import, rate or report.</p>}
              {isOwner && <p className="text-xs text-muted">You can&apos;t rate your own creation.</p>}
            </div>
          </Card>

          {isOwner && (
            <Card>
              <CardHeader title="Manage" />
              <div className="flex flex-col gap-2 p-4">
                <LinkButton href={`/community/${creation.id}/edit`} variant="secondary" size="sm">Edit details & visibility</LinkButton>
                <p className="text-xs text-muted">To publish a new version, open the universe it came from and use Export &amp; share → Publish.</p>
              </div>
            </Card>
          )}

          {creation.allow_derivatives && !isOwner && isPublic && (
            <Card>
              <CardHeader title="Remix" />
              <p className="p-4 text-sm text-muted">Import this into your universe, change it, then publish it from there. Your version credits the original automatically.</p>
            </Card>
          )}

          {auth.user && !isOwner && (
            <Card>
              <details>
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Report this creation</summary>
                <div className="border-t border-border p-4">
                  <ActionForm action={reportAction} submitLabel="Send report" submitVariant="danger" submitSize="sm" resetOnSuccess testId="report-form">
                    <input type="hidden" name="targetType" value="creation" />
                    <input type="hidden" name="creationId" value={creation.id} />
                    <Field label="Reason" htmlFor="category">
                      <Select id="category" name="category" required defaultValue="">
                        <option value="" disabled>Choose a reason…</option>
                        {REPORT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </Select>
                    </Field>
                    <Field label="Details (optional)" htmlFor="details"><Textarea id="details" name="details" rows={3} maxLength={2000} /></Field>
                  </ActionForm>
                  <p className="mt-3 text-xs text-muted">Rights holders can also file a formal <Link href="/policies/ip" className="text-accent">IP takedown request</Link>.</p>
                </div>
              </details>
            </Card>
          )}
        </div>
      </div>
    </SiteShell>
  );
}
