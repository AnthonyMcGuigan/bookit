"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton, fieldError, type ActionState } from "@/components/forms";
import { Field, Input, cx } from "@/components/ui";
import { createUniverseAction } from "./actions";

export function CreateUniverseForm({ idempotencyKey, settingsFields, defaultDate }: { idempotencyKey: string; settingsFields: React.ReactNode; defaultDate: string }) {
  const [state, action] = useActionState(createUniverseAction, {} as ActionState);
  const [mode, setMode] = useState<"starter" | "blank">("starter");
  const [showSettings, setShowSettings] = useState(false);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="mode" value={mode} />
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Starting point</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup">
          {([
            ["starter", "Fictional starter universe", "Two original promotions, 31 wrestlers, champions, rivalries and history. Ready to book."],
            ["blank", "Blank universe", "One empty promotion. Build everything yourself."],
          ] as const).map(([value, title, body]) => (
            <button
              type="button"
              role="radio"
              aria-checked={mode === value}
              key={value}
              onClick={() => setMode(value)}
              className={cx("rounded-xl border p-4 text-left", mode === value ? "border-accent ring-2 ring-accent/30" : "border-border hover:bg-surface-2")}
            >
              <span className="block font-semibold">{title}</span>
              <span className="mt-1 block text-sm text-muted">{body}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <Field label="Universe name" htmlFor="name" error={fieldError(state, "name")}>
        <Input id="name" name="name" required maxLength={80} defaultValue={mode === "starter" ? "Ironside & the Rift" : ""} key={mode} />
      </Field>
      {mode === "blank" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First promotion name" htmlFor="promotionName" error={fieldError(state, "promotionName")}>
            <Input id="promotionName" name="promotionName" maxLength={80} placeholder="e.g. Northern Lights Wrestling" />
          </Field>
          <Field label="Starting date" htmlFor="startDate" error={fieldError(state, "startDate")}>
            <Input id="startDate" name="startDate" type="date" defaultValue={defaultDate} />
          </Field>
        </div>
      )}
      <div>
        <button type="button" className="text-sm font-medium text-accent" onClick={() => setShowSettings((s) => !s)} aria-expanded={showSettings}>
          {showSettings ? "Hide settings" : "Customize settings"}
        </button>
        <div className={cx("mt-3", !showSettings && "hidden")}>{settingsFields}</div>
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Creating universe…">Create universe</SubmitButton>
    </form>
  );
}
