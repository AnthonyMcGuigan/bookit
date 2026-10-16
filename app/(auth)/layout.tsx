import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { Alert } from "@/components/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-8 flex items-center gap-2 self-center font-bold tracking-tight">
        <span aria-hidden className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-sm font-black text-accent-contrast">PW</span>
        Pro Wrestling Booking Simulator
      </Link>
      {!isSupabaseConfigured() && (
        <div className="mb-4">
          <Alert tone="danger" title="Accounts are unavailable">
            The online backend is not configured on this server. See the README for setup.
          </Alert>
        </div>
      )}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">{children}</div>
    </main>
  );
}
