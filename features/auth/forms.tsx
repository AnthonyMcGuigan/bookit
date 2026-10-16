"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormMessage, FormPendingContext, SubmitButton, fieldError, keepValuesSubmit, type ActionState } from "@/components/forms";
import { Checkbox, Field, Input } from "@/components/ui";
import {
  requestPasswordResetAction,
  resendConfirmationAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
} from "./actions";

const initial: ActionState = {};

export function SignInForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signInAction, initial);
  const [resendState, resend, resendPending] = useActionState(resendConfirmationAction, initial);
  return (
    <div className="space-y-4">
      <form action={action} onSubmit={keepValuesSubmit(action)} className="space-y-4" noValidate>
      <FormPendingContext value={pending}>
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label="Email" htmlFor="email" error={fieldError(state, "email")}>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password" htmlFor="password" error={fieldError(state, "password")}>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <FormMessage state={state} />
        <SubmitButton className="w-full" pendingLabel="Signing in…">Sign in</SubmitButton>
      </FormPendingContext>
      </form>
      {state.data?.unconfirmed ? (
        <form action={resend} onSubmit={keepValuesSubmit(resend)} className="space-y-2 rounded-lg border border-border p-3">
          <FormPendingContext value={resendPending}>
          <p className="text-sm">Didn&apos;t get the email?</p>
          <Input name="email" type="email" placeholder="you@example.com" aria-label="Email for confirmation" required />
          <FormMessage state={resendState} />
          <SubmitButton variant="secondary" size="sm" pendingLabel="Sending…">Resend confirmation</SubmitButton>
        </FormPendingContext>
      </form>
      ) : null}
      <div className="flex justify-between text-sm">
        <Link href="/forgot-password" className="text-muted hover:text-text">Forgot password?</Link>
        <Link href="/sign-up" className="font-medium text-accent">Create an account</Link>
      </div>
    </div>
  );
}

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUpAction, initial);
  if (state.ok) {
    return (
      <div className="space-y-3">
        <FormMessage state={state} />
        <p className="text-sm text-muted">After confirming, sign in to start your first universe.</p>
        <Link href="/sign-in" className="text-sm font-medium text-accent">Go to sign in</Link>
      </div>
    );
  }
  return (
    <form action={action} onSubmit={keepValuesSubmit(action)} className="space-y-4" noValidate>
      <FormPendingContext value={pending}>
      <Field label="Display name" htmlFor="displayName" hint="Shown on your public creator profile." error={fieldError(state, "displayName")}>
        <Input id="displayName" name="displayName" autoComplete="nickname" maxLength={40} required />
      </Field>
      <Field label="Email" htmlFor="email" error={fieldError(state, "email")}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 8 characters." error={fieldError(state, "password")}>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <div>
        <Checkbox
          name="acceptPolicies"
          label={
            <>
              I agree to the <Link className="underline" href="/policies/content" target="_blank">content policy</Link> and{" "}
              <Link className="underline" href="/policies/guidelines" target="_blank">creator guidelines</Link>.
            </>
          }
        />
        {fieldError(state, "acceptPolicies") && <p className="text-xs text-danger">{fieldError(state, "acceptPolicies")}</p>}
      </div>
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingLabel="Creating account…">Create account</SubmitButton>
      <p className="text-center text-sm text-muted">
        Already have an account? <Link href="/sign-in" className="font-medium text-accent">Sign in</Link>
      </p>
    </FormPendingContext>
      </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, initial);
  return (
    <form action={action} onSubmit={keepValuesSubmit(action)} className="space-y-4" noValidate>
      <FormPendingContext value={pending}>
      <Field label="Email" htmlFor="email" error={fieldError(state, "email")}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingLabel="Sending…">Send reset link</SubmitButton>
      <p className="text-center text-sm"><Link href="/sign-in" className="text-muted hover:text-text">Back to sign in</Link></p>
    </FormPendingContext>
      </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, initial);
  return (
    <form action={action} onSubmit={keepValuesSubmit(action)} className="space-y-4" noValidate>
      <FormPendingContext value={pending}>
      <Field label="New password" htmlFor="password" error={fieldError(state, "password")}>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm" error={fieldError(state, "confirm")}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingLabel="Updating…">Update password</SubmitButton>
      {state.ok && <Link href="/universes" className="block text-center text-sm font-medium text-accent">Continue to your universes</Link>}
    </FormPendingContext>
      </form>
  );
}
