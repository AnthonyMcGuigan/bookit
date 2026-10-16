"use client";

import { useFormStatus } from "react-dom";
import { createContext, startTransition, useContext, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { buttonClass } from "./ui";

export interface ActionState {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Arbitrary payload returned to the client (e.g. created id). */
  data?: Record<string, unknown>;
}

/** Pending state for forms submitted through useKeepValuesSubmit (useFormStatus can't see those). */
export const FormPendingContext = createContext(false);

/**
 * Submits a form to a useActionState dispatcher without React's automatic
 * form reset, so a validation error never wipes what the player typed.
 */
export function keepValuesSubmit(dispatch: (formData: FormData) => void, before?: (e: FormEvent<HTMLFormElement>) => boolean) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (before && !before(e)) return;
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const formData = new FormData(e.currentTarget, submitter && submitter.form === e.currentTarget ? submitter : undefined);
    startTransition(() => dispatch(formData));
  };
}

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { pendingLabel?: ReactNode; variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" }) {
  const status = useFormStatus();
  const contextPending = useContext(FormPendingContext);
  const pending = status.pending || contextPending;
  return (
    <button type="submit" disabled={pending || props.disabled} aria-busy={pending} className={buttonClass(variant, size, className)} {...props}>
      {pending ? (pendingLabel ?? "Saving…") : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState | undefined | null }) {
  if (!state) return null;
  if (state.error)
    return (
      <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
        {state.error}
      </p>
    );
  if (state.message)
    return (
      <p role="status" className="rounded-lg border border-success/30 bg-success-soft px-3 py-2 text-sm text-success">
        {state.message}
      </p>
    );
  return null;
}

export function fieldError(state: ActionState | undefined | null, name: string): string | undefined {
  return state?.fieldErrors?.[name]?.[0];
}

/** A submit button that asks for confirmation before submitting. */
export function ConfirmSubmit({ message, children, ...props }: ComponentProps<typeof SubmitButton> & { message: string }) {
  return (
    <SubmitButton
      {...props}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </SubmitButton>
  );
}
