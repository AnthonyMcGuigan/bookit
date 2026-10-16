import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/layout/site-header";
import { ActionForm } from "@/components/action-form";
import { Alert, Badge, Card, CardHeader, Field, PageHeader, Textarea } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { submitAppealAction } from "@/features/moderation/actions";
import { MODERATION_LABELS, REPORT_CATEGORIES } from "@/features/community/constants";

export const metadata: Metadata = { title: "Moderation notices" };

const CATEGORY = Object.fromEntries(REPORT_CATEGORIES.map((c) => [c.value, c.label]));
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function AccountModerationPage() {
  const user = await requireUser("/account/moderation");
  const supabase = await createSupabaseServerClient();
  const [{ data: restrictions }, { data: creations }, { data: appeals }, { data: reports }] = await Promise.all([
    supabase.from("account_restrictions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("community_creations").select("id, title, moderation_state, moderation_reason, updated_at").eq("owner_id", user.id).neq("moderation_state", "approved").order("updated_at", { ascending: false }),
    supabase.from("appeals").select("*").eq("appellant_id", user.id).order("created_at", { ascending: false }),
    supabase.from("reports").select("id, category, status, resolution_note, created_at, creation_id, target_type").eq("reporter_id", user.id).order("created_at", { ascending: false }).limit(30),
  ]);
  const creationIds = (creations ?? []).map((c) => c.id);
  const { data: actions } = creationIds.length
    ? await supabase.from("moderation_actions").select("creation_id, action, reason, created_at").in("creation_id", creationIds).order("created_at", { ascending: false })
    : { data: [] };
  const now = new Date().toISOString();
  const activeRestrictions = (restrictions ?? []).filter((r) => !r.lifted_at && (!r.ends_at || r.ends_at > now));
  const openAppeal = new Set((appeals ?? []).filter((a) => a.status === "open").map((a) => a.creation_id));

  return (
    <SiteShell>
      <PageHeader title="Moderation notices" subtitle="Decisions about your community activity, with the reasons moderators gave." />
      <div className="mx-auto max-w-3xl space-y-4">
        {activeRestrictions.length === 0 ? (
          <Alert tone="success">Your account is in good standing.</Alert>
        ) : (
          activeRestrictions.map((r) => (
            <Alert key={r.id} tone="danger" title={r.kind === "suspended" ? "Community activity suspended" : "Publishing disabled"}>
              {r.reason} {r.ends_at ? `Ends ${day(r.ends_at)}.` : "Until lifted by a moderator."} Your private universes are not affected.
            </Alert>
          ))
        )}

        <Card>
          <CardHeader title="Your creations needing attention" />
          {(creations ?? []).length === 0 ? (
            <p className="p-4 text-sm text-muted">Nothing here. All your creations are approved.</p>
          ) : (
            <ul className="divide-y divide-border">
              {(creations ?? []).map((c) => {
                const history = (actions ?? []).filter((a) => a.creation_id === c.id).slice(0, 3);
                const appealable = ["hidden", "removed", "rejected"].includes(c.moderation_state);
                return (
                  <li key={c.id} className="space-y-2 p-4 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/community/${c.id}`} className="font-medium hover:text-accent">{c.title}</Link>
                      <Badge tone={c.moderation_state === "pending" ? "gold" : "danger"}>{MODERATION_LABELS[c.moderation_state]}</Badge>
                    </div>
                    {c.moderation_reason && <p className="text-muted">{c.moderation_reason}</p>}
                    {history.length > 0 && (
                      <ul className="space-y-0.5 text-xs text-muted">
                        {history.map((h, i) => <li key={i}>{day(h.created_at)}: {h.action.replaceAll("_", " ")}. {h.reason}</li>)}
                      </ul>
                    )}
                    {appealable && !openAppeal.has(c.id) && (
                      <details>
                        <summary className="cursor-pointer text-accent">Appeal this decision</summary>
                        <div className="mt-2">
                          <ActionForm action={submitAppealAction} submitLabel="Submit appeal" submitSize="sm">
                            <input type="hidden" name="creationId" value={c.id} />
                            <Field label="Why should this decision change?" htmlFor={`appeal-${c.id}`}>
                              <Textarea id={`appeal-${c.id}`} name="message" rows={3} minLength={10} maxLength={2000} required />
                            </Field>
                          </ActionForm>
                        </div>
                      </details>
                    )}
                    {openAppeal.has(c.id) && <p className="text-xs text-upcoming">Appeal under review.</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Your appeals" />
          {(appeals ?? []).length === 0 ? <p className="p-4 text-sm text-muted">No appeals.</p> : (
            <ul className="divide-y divide-border text-sm">
              {(appeals ?? []).map((a) => (
                <li key={a.id} className="p-4">
                  <p><Badge tone={a.status === "upheld" ? "success" : a.status === "open" ? "gold" : "neutral"}>{a.status === "open" ? "Under review" : a.status === "upheld" ? "Upheld" : "Denied"}</Badge> <span className="text-xs text-muted">{day(a.created_at)}</span></p>
                  {a.moderator_note && <p className="mt-1 text-muted">{a.moderator_note}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Reports you've filed" />
          {(reports ?? []).length === 0 ? <p className="p-4 text-sm text-muted">No reports.</p> : (
            <ul className="divide-y divide-border text-sm">
              {(reports ?? []).map((r) => (
                <li key={r.id} className="p-4">
                  <p>{CATEGORY[r.category] ?? r.category} · <span className="text-muted">{day(r.created_at)}</span> · {r.status === "open" ? "Open" : r.status === "actioned" ? "Action taken" : "No violation found"}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <p className="text-xs text-muted">Read the <Link href="/policies/content" className="text-accent">content policy</Link> and <Link href="/policies/guidelines" className="text-accent">creator guidelines</Link>.</p>
      </div>
    </SiteShell>
  );
}
