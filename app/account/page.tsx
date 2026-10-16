import type { Metadata } from "next";
import Link from "next/link";
import { getProfile, isModerator, requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getEntitlementSummary } from "@/lib/entitlements/service";
import { FEATURE_INFO, LIMITED_FEATURES, describeEntitlement } from "@/lib/entitlements/features";
import { devEntitlementsAllowed } from "@/lib/supabase/env";
import { Alert, Badge, Button, Card, CardHeader, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { SiteShell } from "@/components/layout/site-header";
import { ActionForm } from "@/components/action-form";
import { changeEmailAction, changePasswordAction, devSetEntitlementAction, updateProfileAction } from "@/features/account/actions";
import { signOutAction } from "@/features/auth/actions";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser("/account");
  const supabase = await createSupabaseServerClient();
  const [profile, summary, moderator, restriction] = await Promise.all([
    getProfile(user.id),
    getEntitlementSummary(supabase).catch(() => null),
    isModerator(user.id),
    supabase.from("account_restrictions").select("kind, reason, ends_at, created_at").eq("user_id", user.id).is("lifted_at", null).or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const showDev = devEntitlementsAllowed() && summary?.devEntitlementsEnabled;
  return (
    <SiteShell>
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Account" subtitle={user.email} actions={<form action={signOutAction}><Button variant="secondary" size="sm">Sign out</Button></form>} />
        {restriction.data && (
          <div className="mb-4">
            <Alert tone="danger" title="Community access restricted">
              {restriction.data.reason || "A moderator restricted community features on your account."} Your private universes are unaffected.{" "}
              <Link href="/account/moderation" className="underline">View details and appeal</Link>
            </Alert>
          </div>
        )}
        <Card className="mb-4">
          <CardHeader title="Public profile" subtitle={profile ? <Link className="text-accent" href={`/creators/${profile.handle}`}>View your creator page</Link> : undefined} />
          <div className="p-4">
            <ActionForm action={updateProfileAction} submitLabel="Save profile">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Display name" htmlFor="display_name"><Input id="display_name" name="display_name" required maxLength={40} defaultValue={profile?.display_name} /></Field>
                <Field label="Handle" htmlFor="handle" hint="Used in your creator page link."><Input id="handle" name="handle" required maxLength={24} defaultValue={profile?.handle} /></Field>
                <Field label="Website" htmlFor="website_url"><Input id="website_url" name="website_url" type="url" placeholder="https://" defaultValue={profile?.website_url ?? ""} /></Field>
                <Field label="Bio" htmlFor="bio" className="sm:col-span-2"><Textarea id="bio" name="bio" maxLength={500} defaultValue={profile?.bio} /></Field>
              </div>
            </ActionForm>
          </div>
        </Card>

        <Card className="mb-4">
          <CardHeader title="Plan" subtitle="Your saves are never deleted if a plan ends; you just can't add beyond the free limits." />
          {summary ? (
            <div className="space-y-3 p-4">
              <p className="flex items-center gap-2 text-sm">Current plan: <Badge tone={summary.plan === "premium" ? "gold" : "neutral"}>{summary.plan}</Badge></p>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {LIMITED_FEATURES.map((f) => (
                  <li key={f} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span><span className="font-medium">{FEATURE_INFO[f].label}</span><span className="block text-xs text-muted">{FEATURE_INFO[f].description}</span></span>
                    <span className="shrink-0 text-right text-xs">
                      {f in summary.usage ? `${FEATURE_INFO[f].format(summary.usage[f as keyof typeof summary.usage])} / ` : ""}
                      {FEATURE_INFO[f].format(summary.limits[f])}
                    </span>
                  </li>
                ))}
              </ul>
              {summary.entitlements.length > 0 && (
                <ul className="space-y-1 text-xs text-muted">
                  {summary.entitlements.map((e) => (
                    <li key={e.id}>{e.source} entitlement · {describeEntitlement(e)}{e.expires_at ? ` · until ${new Date(e.expires_at).toLocaleDateString()}` : ""}</li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted">Purchases aren't available yet. No payment provider is connected, and nothing is ever charged.</p>
            </div>
          ) : (
            <div className="p-4"><Alert tone="danger">Plan information is temporarily unavailable.</Alert></div>
          )}
          {showDev && (
            <div className="border-t border-border p-4">
              <p className="mb-2 text-sm font-semibold">Development entitlement testing</p>
              <p className="mb-3 text-xs text-muted">Only visible on development servers. Simulates plan states without a payment provider.</p>
              <ActionForm action={devSetEntitlementAction} submitLabel="Apply test state" submitVariant="secondary" submitSize="sm">
                <Select name="state" aria-label="Test state" defaultValue="active">
                  <option value="none">Free (no entitlement)</option>
                  <option value="active">Premium active</option>
                  <option value="cancelled_active">Premium cancelled, active until expiry</option>
                  <option value="expired">Premium expired</option>
                </Select>
              </ActionForm>
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader title="Email" />
            <div className="p-4">
              <ActionForm action={changeEmailAction} submitLabel="Change email" submitVariant="secondary" submitSize="sm">
                <Field label="New email" htmlFor="email"><Input id="email" name="email" type="email" required autoComplete="email" /></Field>
              </ActionForm>
            </div>
          </Card>
          <Card>
            <CardHeader title="Password" />
            <div className="p-4">
              <ActionForm action={changePasswordAction} submitLabel="Change password" submitVariant="secondary" submitSize="sm" resetOnSuccess>
                <Field label="Current password" htmlFor="current_password"><Input id="current_password" name="current_password" type="password" required autoComplete="current-password" /></Field>
                <Field label="New password" htmlFor="new_password"><Input id="new_password" name="new_password" type="password" required minLength={8} autoComplete="new-password" /></Field>
                <Field label="Confirm new password" htmlFor="confirm_password"><Input id="confirm_password" name="confirm_password" type="password" required minLength={8} autoComplete="new-password" /></Field>
              </ActionForm>
            </div>
          </Card>
        </div>

        <Card className="mt-4">
          <CardHeader title="More" />
          <ul className="divide-y divide-border text-sm">
            <li><Link href="/universes" className="block px-4 py-3 hover:bg-surface-2">My universes</Link></li>
            <li><Link href="/community/mine" className="block px-4 py-3 hover:bg-surface-2">My community creations</Link></li>
            <li><Link href="/account/moderation" className="block px-4 py-3 hover:bg-surface-2">Moderation notices and appeals</Link></li>
            {moderator && <li><Link href="/moderation" className="block px-4 py-3 hover:bg-surface-2">Moderator dashboard</Link></li>}
            <li><Link href="/policies/content" className="block px-4 py-3 hover:bg-surface-2">Content policy</Link></li>
          </ul>
        </Card>
      </div>
    </SiteShell>
  );
}
