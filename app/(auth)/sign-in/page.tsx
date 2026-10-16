import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInForm } from "@/features/auth/forms";
import { getSessionUser, safeNext } from "@/lib/auth/session";
import { Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  if (await getSessionUser()) redirect(safeNext(params.next));
  return (
    <>
      <h1 className="mb-1 text-xl font-bold">Sign in</h1>
      <p className="mb-5 text-sm text-muted">An account keeps your universes saved in the cloud.</p>
      {params.error === "link" && <div className="mb-4"><Alert tone="danger">That link is invalid or has expired. Request a new one.</Alert></div>}
      {params.error === "unavailable" && <div className="mb-4"><Alert tone="danger">The account service is unavailable right now. Please try again shortly.</Alert></div>}
      <SignInForm next={params.next} />
    </>
  );
}
