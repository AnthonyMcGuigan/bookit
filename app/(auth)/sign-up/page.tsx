import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/features/auth/forms";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage() {
  if (await getSessionUser()) redirect("/universes");
  return (
    <>
      <h1 className="mb-1 text-xl font-bold">Create your account</h1>
      <p className="mb-5 text-sm text-muted">Free to play. Your universes are private cloud saves.</p>
      <SignUpForm />
    </>
  );
}
