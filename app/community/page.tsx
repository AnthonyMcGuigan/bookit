import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/layout/site-header";
import { EmptyState, Input, LinkButton, PageHeader, Select, buttonClass, cx } from "@/components/ui";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PACKAGE_KINDS } from "@/lib/packages/schema";
import { CATEGORY_LABELS } from "@/features/community/constants";
import { CreationCard, type CreationListItem } from "@/features/community/creation-card";
import { CREATION_LIST_COLUMNS, profilesFor, safeSearch } from "@/features/community/queries";

export const metadata: Metadata = { title: "Community library" };

const PAGE_SIZE = 24;
const SORTS = { newest: "Newest", top: "Top rated", downloads: "Most downloaded" } as const;

export default async function CommunityPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const category = PACKAGE_KINDS.find((k) => k === params.category) ?? null;
  const sort = (params.sort && params.sort in SORTS ? params.sort : "newest") as keyof typeof SORTS;
  const q = safeSearch(params.q ?? "");
  const tag = (params.tag ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 24);
  const page = Math.max(1, Math.min(200, Number(params.page) || 1));

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  let query = supabase
    .from("community_creations")
    .select(CREATION_LIST_COLUMNS, { count: "estimated" })
    .eq("visibility", "published")
    .eq("moderation_state", "approved")
    .gt("current_version", 0);
  if (category) query = query.eq("category", category);
  if (tag) query = query.contains("tags", [tag]);
  if (q) query = query.or(`title.ilike.%${q}%,summary.ilike.%${q}%,description.ilike.%${q}%`);
  query =
    sort === "top"
      ? query.order("rating_sum", { ascending: false }).order("rating_count", { ascending: true })
      : sort === "downloads"
        ? query.order("download_count", { ascending: false })
        : query.order("published_at", { ascending: false, nullsFirst: false });
  const { data, count, error } = await query.order("id").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const creations = (data ?? []) as CreationListItem[];
  const authors = await profilesFor(supabase, creations.map((c) => c.owner_id));
  const link = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams();
    const merged = { category, sort: sort === "newest" ? null : sort, q: q || null, tag: tag || null, page: null, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, String(v));
    const s = next.toString();
    return s ? `/community?${s}` : "/community";
  };
  const hasMore = creations.length === PAGE_SIZE;

  return (
    <SiteShell>
      <PageHeader
        title="Community library"
        subtitle="Wrestlers, promotions, championships, storylines and whole universes made by players."
        actions={auth.user ? <LinkButton href="/community/mine" size="sm" variant="secondary">My creations</LinkButton> : undefined}
      />
      <form action="/community" className="mb-3 flex flex-col gap-2 sm:flex-row" role="search">
        {category && <input type="hidden" name="category" value={category} />}
        <Input name="q" defaultValue={q} placeholder="Search titles and descriptions" aria-label="Search" className="sm:flex-1" />
        <Select name="sort" defaultValue={sort} aria-label="Sort" className="sm:w-48">
          {Object.entries(SORTS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </Select>
        <button className={buttonClass("primary", "md")}>Search</button>
      </form>
      <nav aria-label="Categories" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Link href={link({ category: null })} className={cx("shrink-0 rounded-full border px-3 py-1.5 text-sm", !category ? "border-accent bg-accent text-accent-contrast" : "border-border")}>All</Link>
        {PACKAGE_KINDS.map((k) => (
          <Link key={k} href={link({ category: k })} className={cx("shrink-0 rounded-full border px-3 py-1.5 text-sm", category === k ? "border-accent bg-accent text-accent-contrast" : "border-border")}>
            {CATEGORY_LABELS[k]}
          </Link>
        ))}
      </nav>
      {tag && (
        <p className="mb-3 text-sm">
          Tagged <span className="font-semibold">#{tag}</span> · <Link href={link({ tag: null })} className="text-accent">clear</Link>
        </p>
      )}
      {error ? (
        <EmptyState title="The library is unavailable right now" description="Please try again shortly." />
      ) : creations.length === 0 ? (
        <EmptyState title="Nothing here yet" description={q || tag || category ? "Try a different search or category." : "Be the first to share something from your universe."} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="creation-list">
          {creations.map((c) => <CreationCard key={c.id} creation={c} author={authors.get(c.owner_id)} />)}
        </ul>
      )}
      {(page > 1 || hasMore) && (
        <div className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={link({ page: String(page - 1) })} className="text-accent">← Previous</Link> : <span />}
          <span className="text-muted">Page {page}{count ? ` of ${Math.max(1, Math.ceil(count / PAGE_SIZE))}` : ""}</span>
          {hasMore ? <Link href={link({ page: String(page + 1) })} className="text-accent">Next →</Link> : <span />}
        </div>
      )}
    </SiteShell>
  );
}
