import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/features/auth/forms";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="mb-1 text-xl font-bold">Reset your password</h1>
      <p className="mb-5 text-sm text-muted">We&apos;ll email you a link to choose a new password.</p>
      <ForgotPasswordForm />
    </>
  );
}
