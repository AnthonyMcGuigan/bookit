import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";

export async function SiteHeader() {
  const user = await getSessionUser();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href={user ? "/universes" : "/"} className="flex items-center gap-2 font-bold tracking-tight">
          <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-sm font-black text-accent-contrast">PW</span>
          <span className="hidden sm:inline">Booking Simulator</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm" aria-label="Site">
          {user ? (
            <>
              <Link className="rounded-lg px-3 py-2 hover:bg-surface-2" href="/universes">Universes</Link>
              <Link className="rounded-lg px-3 py-2 hover:bg-surface-2" href="/community">Community</Link>
              <Link className="rounded-lg px-3 py-2 hover:bg-surface-2" href="/account">Account</Link>
            </>
          ) : (
            <>
              <Link className="rounded-lg px-3 py-2 hover:bg-surface-2" href="/community">Community</Link>
              <Link className="rounded-lg px-3 py-2 hover:bg-surface-2" href="/sign-in">Sign in</Link>
              <Link className="rounded-lg bg-accent px-3 py-2 font-medium text-accent-contrast" href="/sign-up">Create account</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-12 max-w-6xl px-4 pb-24 text-xs text-muted lg:pb-8">
      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-4">
        <span>© Pro Wrestling Booking Simulator. Fictional content; not affiliated with any real promotion.</span>
        <Link href="/policies/content" className="hover:text-text">Content policy</Link>
        <Link href="/policies/guidelines" className="hover:text-text">Creator guidelines</Link>
        <Link href="/policies/ip" className="hover:text-text">IP &amp; takedowns</Link>
      </div>
    </footer>
  );
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-6xl px-4 py-6">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
