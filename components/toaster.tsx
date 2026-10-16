"use client";

import { useSyncExternalStore } from "react";

interface Toast {
  id: number;
  message: string;
  tone: "success" | "danger";
}

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Shows a transient message that survives the form that triggered it unmounting. */
export function toast(message: string, tone: Toast["tone"] = "success") {
  const id = nextId++;
  toasts = [...toasts, { id, message, tone }].slice(-3);
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 5000);
}

const EMPTY: Toast[] = [];

export function Toaster() {
  const items = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => toasts,
    () => EMPTY,
  );
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={
            t.tone === "success"
              ? "pointer-events-auto max-w-md rounded-lg border border-success/30 bg-surface px-4 py-2 text-sm text-success shadow-lg"
              : "pointer-events-auto max-w-md rounded-lg border border-danger/30 bg-surface px-4 py-2 text-sm text-danger shadow-lg"
          }
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
