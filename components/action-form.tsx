"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { FormMessage, SubmitButton, type ActionState } from "./forms";
import { toast } from "./toaster";
import { cx } from "./ui";

type ServerAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Generic progressive-enhancement form for server actions. Shows the action's
 * error/success message and a summary of field errors under the fields.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel,
  submitVariant = "primary",
  submitSize = "md",
  className,
  resetOnSuccess = false,
  confirm,
  redirectTo,
  hideSubmit = false,
  footer,
  testId,
}: {
  action: ServerAction;
  children: ReactNode;
  submitLabel?: ReactNode;
  pendingLabel?: ReactNode;
  submitVariant?: "primary" | "secondary" | "ghost" | "danger";
  submitSize?: "sm" | "md";
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
  redirectTo?: string;
  hideSubmit?: boolean;
  footer?: ReactNode;
  testId?: string;
}) {
  const [state, formAction] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await action(prev, formData);
    // Toast from the action callback: the form may unmount when the page refreshes.
    if (result?.ok && result.message) toast(result.message);
    return result ?? {};
  }, {} as ActionState);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
    if (state.ok && redirectTo) router.push(redirectTo);
  }, [state, resetOnSuccess, redirectTo, router]);
  const errors = Object.entries(state.fieldErrors ?? {}).filter(([, v]) => v && v.length);
  return (
    <form
      ref={ref}
      action={formAction}
      className={cx("space-y-4", className)}
      data-testid={testId}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      <FormMessage state={state.ok ? null : state} />
      {errors.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-danger">
          {errors.map(([k, v]) => (
            <li key={k}>
              <span className="font-medium">{humanize(k)}</span>: {v![0]}
            </li>
          ))}
        </ul>
      )}
      {(!hideSubmit || footer) && (
        <div className="flex flex-wrap items-center gap-2">
          {!hideSubmit && (
            <SubmitButton variant={submitVariant} size={submitSize} pendingLabel={pendingLabel}>
              {submitLabel ?? "Save"}
            </SubmitButton>
          )}
          {footer}
        </div>
      )}
    </form>
  );
}

function humanize(key: string) {
  const s = key.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
