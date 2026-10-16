import type { Metadata } from "next";
import { ResetPasswordForm } from "@/features/auth/forms";
import { requireUser } from "@/lib/auth/session";
import { SiteShell } from "@/components/layout/site-header";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  await requireUser("/account/reset-password");
  return (
    <SiteShell>
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-surface p-6">
        <h1 className="mb-4 text-xl font-bold">Choose a new password</h1>
        <ResetPasswordForm />
      </div>
    </SiteShell>
  );
}
