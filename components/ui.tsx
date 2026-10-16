/**
 * Shared presentational components. Server-component friendly (no hooks).
 */
import Link from "next/link";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

export { clsx as cx };

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 select-none whitespace-nowrap";
const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-contrast hover:opacity-90",
  secondary: "border border-border bg-surface text-text hover:bg-surface-2",
  ghost: "text-text hover:bg-surface-2",
  danger: "bg-danger text-white hover:opacity-90",
};
const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return clsx(buttonBase, buttonVariants[variant], buttonSizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Card({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div className={clsx("rounded-xl border border-border bg-surface", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, action, subtitle }: { title: ReactNode; action?: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-1 inline-flex items-center gap-1 text-sm text-muted hover:text-text">
            <span aria-hidden>‹</span> {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

type BadgeTone = "neutral" | "gold" | "danger" | "rivalry" | "upcoming" | "success" | "accent";
const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-muted",
  gold: "bg-gold-soft text-gold",
  danger: "bg-danger-soft text-danger",
  rivalry: "bg-rivalry-soft text-rivalry",
  upcoming: "bg-upcoming-soft text-upcoming",
  success: "bg-success-soft text-success",
  accent: "bg-accent text-accent-contrast",
};

export function Badge({ tone = "neutral", children, className, title }: { tone?: BadgeTone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", badgeTones[tone], className)}>
      {children}
    </span>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {description && <p className="max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Alert({ tone = "neutral", title, children }: { tone?: "neutral" | "danger" | "success" | "gold" | "upcoming"; title?: ReactNode; children?: ReactNode }) {
  const tones = {
    neutral: "border-border bg-surface-2",
    danger: "border-danger/30 bg-danger-soft text-danger",
    success: "border-success/30 bg-success-soft text-success",
    gold: "border-gold/30 bg-gold-soft text-gold",
    upcoming: "border-upcoming/30 bg-upcoming-soft text-upcoming",
  } as const;
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={clsx("rounded-lg border px-3 py-2 text-sm", tones[tone])}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={clsx(title && "mt-0.5")}>{children}</div>}
    </div>
  );
}

export function StatBar({ label, value, max = 100, min = 0, tone = "accent" }: { label: string; value: number; max?: number; min?: number; tone?: "accent" | "gold" | "danger" | "success" | "upcoming" }) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const fill = { accent: "bg-accent", gold: "bg-gold", danger: "bg-danger", success: "bg-success", upcoming: "bg-upcoming" }[tone];
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 shrink-0 text-muted">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2" role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={min} aria-valuemax={max}>
        <div className={clsx("h-full rounded-full", fill)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Field({ label, htmlFor, hint, error, children, className }: { label: string; htmlFor?: string; hint?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return (
    <div className={clsx("flex flex-col gap-1", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

const inputBase =
  "w-full rounded-lg border border-border bg-surface px-3 text-sm text-text placeholder:text-muted/70 focus:border-accent focus:outline-none disabled:opacity-60";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={clsx(inputBase, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={clsx(inputBase, "min-h-24 py-2", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={clsx(inputBase, "h-11 pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ label, hint, ...props }: ComponentProps<"input"> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg py-1">
      <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]" {...props} />
      <span>
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{children}</h2>
      {action}
    </div>
  );
}

export function List({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={clsx("divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface", className)}>{children}</ul>;
}

export function ListLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <li>
      <Link href={href} className={clsx("flex items-center gap-3 px-4 py-3 hover:bg-surface-2", className)}>
        {children}
        <span aria-hidden className="ml-auto text-muted">›</span>
      </Link>
    </li>
  );
}

export function formatMoney(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount.toLocaleString("en-US")} ${currency}`;
  }
}

export function Stars({ value }: { value: number }) {
  const full = Math.floor(value);
  const frac = value - full;
  const fracText = frac === 0.25 ? "¼" : frac === 0.5 ? "½" : frac === 0.75 ? "¾" : "";
  return (
    <span className="whitespace-nowrap font-semibold text-gold" aria-label={`${value} stars`}>
      {"★".repeat(full)}
      {fracText}
      {value === 0 && "DUD"}
    </span>
  );
}
