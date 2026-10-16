import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/layout/site-header";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, CardHeader, EmptyState, Field, Input, PageHeader, Select, Textarea, cx } from "@/components/ui";
import { requireUser, getRoles } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PACKAGE_KIND_LABELS, type PackageKind } from "@/lib/packages/schema";
import { profilesFor } from "@/features/community/queries";
import { MODERATION_LABELS, REPORT_CATEGORIES } from "@/features/community/constants";
import {
  decideAppealAction,
  liftRestrictionAction,
  moderateCreationAction,
  resolveReportAction,
  resolveTakedownAction,
  restrictAccountAction,
  setRoleAction,
} from "@/features/moderation/actions";

export const metadata: Metadata = { title: "Moderation" };

const TABS = { queue: "Review queue", reports: "Reports", appeals: "Appeals", takedowns: "IP takedowns", accounts: "Accounts", audit: "Audit log" } as const;
type Tab = keyof typeof TABS;
const CATEGORY = Object.fromEntries(REPORT_CATEGORIES.map((c) => [c.value, c.label]));
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function ReasonField({ name = "reason", label = "Reason (shown to the creator and logged)" }: { name?: string; label?: string }) {
  return (
    // Wrapping label (no id) because several of these forms appear on one page.
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <Textarea name={name} rows={2} required minLength={3} maxLength={2000} />
    </label>
  );
}

export default async function ModerationPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const user = await requireUser("/moderation");
  const roles = await getRoles(user.id);
  if (!roles.includes("moderator") && !roles.includes("admin")) notFound();
  const isAdmin = roles.includes("admin");
  const tab: Tab = params.tab && params.tab in TABS ? (params.tab as Tab) : "queue";
  const supabase = await createSupabaseServerClient();

  const [pendingCount, reportCount, appealCount, takedownCount] = await Promise.all([
    supabase.from("community_creations").select("id", { count: "exact", head: true }).in("moderation_state", ["pending", "hidden"]).gt("current_version", 0),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("appeals").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("ip_takedown_requests").select("id", { count: "exact", head: true }).eq("status", "received"),
  ]);
  const badge: Partial<Record<Tab, number | null>> = { queue: pendingCount.count, reports: reportCount.count, appeals: appealCount.count, takedowns: takedownCount.count };

  return (
    <SiteShell>
      <PageHeader title="Moderation" subtitle="Every decision needs a reason and is written to the audit log." />
      <nav aria-label="Moderation sections" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {(Object.keys(TABS) as Tab[]).map((t) => (
          <Link key={t} href={`/moderation?tab=${t}`} className={cx("shrink-0 rounded-full border px-3 py-1.5 text-sm", tab === t ? "border-accent bg-accent text-accent-contrast" : "border-border")}>
            {TABS[t]}{badge[t] ? ` (${badge[t]})` : ""}
          </Link>
        ))}
      </nav>
      {tab === "queue" && <Queue />}
      {tab === "reports" && <Reports />}
      {tab === "appeals" && <Appeals />}
      {tab === "takedowns" && <Takedowns />}
      {tab === "accounts" && <Accounts isAdmin={isAdmin} />}
      {tab === "audit" && <Audit />}
    </SiteShell>
  );

  async function Queue() {
    const { data } = await supabase
      .from("community_creations")
      .select("id, title, summary, category, owner_id, moderation_state, moderation_reason, report_count, current_version, updated_at, is_fan_content")
      .in("moderation_state", ["pending", "hidden"])
      .gt("current_version", 0)
      .order("updated_at", { ascending: true })
      .limit(50);
    const rows = data ?? [];
    const owners = await profilesFor(supabase, rows.map((r) => r.owner_id));
    if (!rows.length) return <EmptyState title="Nothing waiting for review" />;
    return (
      <ul className="space-y-3" data-testid="moderation-queue">
        {rows.map((c) => (
          <li key={c.id}>
            <Card>
              <CardHeader
                title={<Link href={`/community/${c.id}`} className="hover:text-accent">{c.title}</Link>}
                subtitle={`${PACKAGE_KIND_LABELS[c.category as PackageKind]} · v${c.current_version} · by @${owners.get(c.owner_id)?.handle ?? "unknown"} · ${c.report_count} report(s)`}
                action={<Badge tone={c.moderation_state === "pending" ? "gold" : "danger"}>{MODERATION_LABELS[c.moderation_state]}</Badge>}
              />
              <div className="space-y-3 p-4">
                {c.moderation_reason && <p className="text-xs text-muted">{c.moderation_reason}</p>}
                {c.is_fan_content && <p className="text-xs text-muted">Marked as fan content: check for real people&apos;s photos, logos or trademarks.</p>}
                <ActionForm action={moderateCreationAction} submitLabel="Record decision" submitSize="sm">
                  <input type="hidden" name="creationId" value={c.id} />
                  <Field label="Decision" htmlFor={`action-${c.id}`}>
                    <Select id={`action-${c.id}`} name="action" defaultValue="approve">
                      <option value="approve">Approve (make visible)</option>
                      <option value="reject">Reject</option>
                      <option value="hide">Keep hidden</option>
                      <option value="remove">Remove permanently</option>
                    </Select>
                  </Field>
                  <ReasonField name={`reason`} />
                </ActionForm>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    );
  }

  async function Reports() {
    const { data } = await supabase.from("reports").select("*").eq("status", "open").order("created_at", { ascending: true }).limit(50);
    const rows = data ?? [];
    const creationIds = rows.map((r) => r.creation_id).filter((x): x is string => Boolean(x));
    const { data: creations } = creationIds.length ? await supabase.from("community_creations").select("id, title, moderation_state").in("id", creationIds) : { data: [] };
    const byId = new Map((creations ?? []).map((c) => [c.id, c]));
    const people = await profilesFor(supabase, rows.flatMap((r) => [r.reporter_id, r.reported_user_id].filter((x): x is string => Boolean(x))));
    if (!rows.length) return <EmptyState title="No open reports" />;
    return (
      <ul className="space-y-3" data-testid="moderation-reports">
        {rows.map((r) => {
          const creation = r.creation_id ? byId.get(r.creation_id) : null;
          return (
            <li key={r.id}>
              <Card>
                <CardHeader
                  title={CATEGORY[r.category] ?? r.category}
                  subtitle={`${when(r.created_at)} · from @${people.get(r.reporter_id)?.handle ?? "unknown"}`}
                />
                <div className="space-y-3 p-4 text-sm">
                  <p>
                    {creation ? (
                      <>Creation: <Link href={`/community/${creation.id}`} className="text-accent">{creation.title}</Link> <Badge>{MODERATION_LABELS[creation.moderation_state]}</Badge></>
                    ) : r.reported_user_id ? (
                      <>Creator: <Link href={`/creators/${people.get(r.reported_user_id)?.handle ?? ""}`} className="text-accent">@{people.get(r.reported_user_id)?.handle ?? "unknown"}</Link></>
                    ) : "Target no longer exists."}
                  </p>
                  {r.details && <p className="whitespace-pre-line rounded-lg bg-surface-2 p-2 text-xs">{r.details}</p>}
                  {creation && (
                    <ActionForm action={moderateCreationAction} submitLabel="Act on creation" submitSize="sm">
                      <input type="hidden" name="creationId" value={creation.id} />
                      <input type="hidden" name="reportId" value={r.id} />
                      <Field label="Action" htmlFor={`raction-${r.id}`}>
                        <Select id={`raction-${r.id}`} name="action" defaultValue="hide">
                          <option value="restore">Restore / approve (dismisses reports)</option>
                          <option value="hide">Hide</option>
                          <option value="remove">Remove permanently</option>
                        </Select>
                      </Field>
                      <ReasonField />
                    </ActionForm>
                  )}
                  <ActionForm action={resolveReportAction} submitLabel="Resolve report only" submitVariant="secondary" submitSize="sm">
                    <input type="hidden" name="reportId" value={r.id} />
                    <Field label="Resolution" htmlFor={`res-${r.id}`}>
                      <Select id={`res-${r.id}`} name="resolution" defaultValue="dismissed">
                        <option value="dismissed">Dismiss (no violation)</option>
                        <option value="actioned">Mark actioned</option>
                      </Select>
                    </Field>
                    <ReasonField name="note" label="Note (logged)" />
                  </ActionForm>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    );
  }

  async function Appeals() {
    const { data } = await supabase.from("appeals").select("*").eq("status", "open").order("created_at", { ascending: true }).limit(50);
    const rows = data ?? [];
    const { data: creations } = rows.length ? await supabase.from("community_creations").select("id, title, moderation_state, moderation_reason").in("id", rows.map((r) => r.creation_id)) : { data: [] };
    const byId = new Map((creations ?? []).map((c) => [c.id, c]));
    const people = await profilesFor(supabase, rows.map((r) => r.appellant_id));
    if (!rows.length) return <EmptyState title="No open appeals" />;
    return (
      <ul className="space-y-3">
        {rows.map((a) => {
          const c = byId.get(a.creation_id);
          return (
            <li key={a.id}>
              <Card>
                <CardHeader title={c ? <Link href={`/community/${c.id}`} className="hover:text-accent">{c.title}</Link> : "Deleted creation"} subtitle={`${when(a.created_at)} · @${people.get(a.appellant_id)?.handle ?? "unknown"}`} />
                <div className="space-y-3 p-4 text-sm">
                  {c && <p className="text-xs text-muted">Current decision: {MODERATION_LABELS[c.moderation_state]}{c.moderation_reason ? ` (${c.moderation_reason})` : ""}</p>}
                  <p className="whitespace-pre-line rounded-lg bg-surface-2 p-2">{a.message}</p>
                  <ActionForm action={decideAppealAction} submitLabel="Decide" submitSize="sm">
                    <input type="hidden" name="appealId" value={a.id} />
                    <Field label="Decision" htmlFor={`dec-${a.id}`}>
                      <Select id={`dec-${a.id}`} name="decision" defaultValue="deny">
                        <option value="uphold">Uphold (restore the creation)</option>
                        <option value="deny">Deny (keep the decision)</option>
                      </Select>
                    </Field>
                    <ReasonField name="note" label="Explanation (shown to the creator)" />
                  </ActionForm>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    );
  }

  async function Takedowns() {
    const { data } = await supabase.from("ip_takedown_requests").select("*").order("created_at", { ascending: false }).limit(50);
    const rows = data ?? [];
    if (!rows.length) return <EmptyState title="No takedown requests" />;
    return (
      <ul className="space-y-3">
        {rows.map((t) => (
          <li key={t.id}>
            <Card>
              <CardHeader title={`${t.claimant_name}${t.claimant_organization ? ` (${t.claimant_organization})` : ""}`} subtitle={`${when(t.created_at)} · ${t.rights_holder_relationship === "owner" ? "Rights owner" : "Authorized agent"}`} action={<Badge tone={t.status === "received" ? "gold" : "neutral"}>{t.status.replace("_", " ")}</Badge>} />
              <div className="space-y-2 p-4 text-sm">
                <p><span className="text-muted">Contact:</span> {t.claimant_email}</p>
                <p className="break-all"><span className="text-muted">Content:</span> {t.creation_id ? <Link href={`/community/${t.creation_id}`} className="text-accent">{t.infringing_url}</Link> : t.infringing_url}</p>
                <p className="whitespace-pre-line rounded-lg bg-surface-2 p-2 text-xs">{t.work_description}</p>
                <p className="text-xs text-muted">Signed: {t.signature} · good-faith and accuracy statements confirmed</p>
                {t.moderator_note && <p className="text-xs">Note: {t.moderator_note}</p>}
                {t.status === "received" && (
                  <ActionForm action={resolveTakedownAction} submitLabel="Resolve" submitSize="sm">
                    <input type="hidden" name="requestId" value={t.id} />
                    <Field label="Outcome" htmlFor={`td-${t.id}`}>
                      <Select id={`td-${t.id}`} name="status" defaultValue="content_removed">
                        <option value="content_removed">Valid: remove the content</option>
                        <option value="rejected">Invalid: reject (restore separately if hidden)</option>
                        <option value="counter_notice">Counter-notice received</option>
                      </Select>
                    </Field>
                    <ReasonField name="note" label="Note (logged)" />
                  </ActionForm>
                )}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    );
  }

  async function Accounts({ isAdmin }: { isAdmin: boolean }) {
    const { data } = await supabase.from("account_restrictions").select("*").is("lifted_at", null).order("created_at", { ascending: false }).limit(100);
    const now = new Date().toISOString();
    const active = (data ?? []).filter((r) => !r.ends_at || r.ends_at > now);
    const people = await profilesFor(supabase, active.map((r) => r.user_id));
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Restrict an account" />
          <div className="p-4">
            <ActionForm action={restrictAccountAction} submitLabel="Apply restriction" submitVariant="danger" submitSize="sm" resetOnSuccess>
              <Field label="Creator handle" htmlFor="handle"><Input id="handle" name="handle" required placeholder="@handle" /></Field>
              <Field label="Restriction" htmlFor="kind">
                <Select id="kind" name="kind" defaultValue="publishing_disabled">
                  <option value="publishing_disabled">Disable publishing, rating and reporting</option>
                  <option value="suspended">Suspend all community activity</option>
                </Select>
              </Field>
              <Field label="Days (blank = until lifted)" htmlFor="days"><Input id="days" name="days" type="number" min={1} max={3650} inputMode="numeric" /></Field>
              <ReasonField />
              <p className="text-xs text-muted">Restrictions never touch private universes; players keep full access to their saves.</p>
            </ActionForm>
          </div>
        </Card>
        <Card>
          <CardHeader title="Active restrictions" />
          {active.length === 0 ? <p className="p-4 text-sm text-muted">None.</p> : (
            <ul className="divide-y divide-border">
              {active.map((r) => (
                <li key={r.id} className="space-y-2 p-4 text-sm">
                  <p><span className="font-medium">@{people.get(r.user_id)?.handle ?? "unknown"}</span> · {r.kind === "suspended" ? "Suspended" : "Publishing disabled"} · {r.ends_at ? `until ${when(r.ends_at)}` : "indefinite"}</p>
                  <p className="text-xs text-muted">{r.reason}</p>
                  <ActionForm action={liftRestrictionAction} submitLabel="Lift" submitVariant="secondary" submitSize="sm">
                    <input type="hidden" name="restrictionId" value={r.id} />
                    <ReasonField />
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {isAdmin && (
          <Card className="lg:col-span-2">
            <CardHeader title="Roles (admins only)" />
            <div className="p-4">
              <ActionForm action={setRoleAction} submitLabel="Update role" submitSize="sm" resetOnSuccess>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field label="Creator handle" htmlFor="role-handle"><Input id="role-handle" name="handle" required /></Field>
                  <Field label="Role" htmlFor="role"><Select id="role" name="role"><option value="moderator">Moderator</option><option value="admin">Admin</option></Select></Field>
                  <Field label="Change" htmlFor="grant"><Select id="grant" name="grant"><option value="grant">Grant</option><option value="revoke">Revoke</option></Select></Field>
                </div>
                <ReasonField />
              </ActionForm>
            </div>
          </Card>
        )}
      </div>
    );
  }

  async function Audit() {
    const { data } = await supabase.from("moderation_actions").select("*").order("created_at", { ascending: false }).limit(100);
    const rows = data ?? [];
    const people = await profilesFor(supabase, rows.flatMap((r) => [r.moderator_id, r.target_user_id].filter((x): x is string => Boolean(x))));
    if (!rows.length) return <EmptyState title="No actions yet" />;
    return (
      <Card>
        <ul className="divide-y divide-border text-sm" data-testid="audit-log">
          {rows.map((a) => (
            <li key={a.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-3">
              <span className="w-32 shrink-0 text-xs text-muted">{when(a.created_at)}</span>
              <span className="min-w-0">
                <span className="font-medium">{a.action.replaceAll("_", " ")}</span>
                <span className="text-muted"> by {a.moderator_id ? `@${people.get(a.moderator_id)?.handle ?? "unknown"}` : "system"}</span>
                {a.creation_id && <> · <Link href={`/community/${a.creation_id}`} className="text-accent">creation</Link></>}
                {a.target_user_id && <> · @{people.get(a.target_user_id)?.handle ?? "user"}</>}
                <span className="block text-xs text-muted">{a.reason}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    );
  }
}
