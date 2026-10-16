"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const ICONS: Record<string, React.ReactNode> = {
  dashboard: <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />,
  roster: <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />,
  booking: <path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm0 16H5V9h14v11zM7 11h5v5H7z" />,
  championships: <path d="M19 5h-2V3H7v2H5a2 2 0 00-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0011 15.9V19H7v2h10v-2h-4v-3.1a5.01 5.01 0 003.61-2.96C19.08 12.63 21 10.55 21 8V7a2 2 0 00-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />,
  community: <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-1 17.93A8 8 0 014.07 13H7a14.7 14.7 0 004 6.93zM4.07 11A8 8 0 0111 4.07 14.7 14.7 0 007 11H4.07zM12 19.3A12.7 12.7 0 019 13h6a12.7 12.7 0 01-3 6.3zM9 11a12.7 12.7 0 013-6.3A12.7 12.7 0 0115 11H9zm4 8.93A14.7 14.7 0 0017 13h2.93A8 8 0 0113 19.93zM17 11a14.7 14.7 0 00-4-6.93A8 8 0 0119.93 11H17z" />,
  more: <path d="M6 10a2 2 0 100 4 2 2 0 000-4zm6 0a2 2 0 100 4 2 2 0 000-4zm6 0a2 2 0 100 4 2 2 0 000-4z" />,
};

export function UniverseNav({ universeId }: { universeId: string }) {
  const pathname = usePathname();
  const base = `/u/${universeId}`;
  const items = [
    { key: "dashboard", label: "Dashboard", href: base, match: (p: string) => p === base },
    { key: "roster", label: "Roster", href: `${base}/roster`, match: (p: string) => p.startsWith(`${base}/roster`) },
    { key: "booking", label: "Booking", href: `${base}/booking`, match: (p: string) => p.startsWith(`${base}/booking`) },
    { key: "championships", label: "Titles", longLabel: "Championships", href: `${base}/championships`, match: (p: string) => p.startsWith(`${base}/championships`) },
    { key: "community", label: "Community", href: `${base}/community`, match: (p: string) => p.startsWith(`${base}/community`) },
    { key: "more", label: "More", href: `${base}/more`, match: (p: string) => p.startsWith(`${base}/more`) || ["promotions", "teams", "storylines", "finances", "history", "settings", "venues", "export"].some((s) => p.startsWith(`${base}/${s}`)) },
  ];
  return (
    <>
      {/* Desktop sidebar */}
      <nav aria-label="Universe" className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-56 shrink-0 flex-col gap-1 border-r border-border bg-surface p-3 lg:flex">
        {items.map((item) => {
          const active = item.match(pathname);
          return (
            <Link key={item.key} href={item.href} aria-current={active ? "page" : undefined} className={clsx("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium", active ? "bg-accent text-accent-contrast" : "text-text hover:bg-surface-2")}>
              <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 fill-current">{ICONS[item.key]}</svg>
              {item.longLabel ?? item.label}
            </Link>
          );
        })}
      </nav>
      {/* Mobile bottom bar */}
      <nav aria-label="Universe" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="grid grid-cols-6">
          {items.map((item) => {
            const active = item.match(pathname);
            return (
              <li key={item.key}>
                <Link href={item.href} aria-current={active ? "page" : undefined} className={clsx("flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium", active ? "text-accent" : "text-muted")}>
                  <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 fill-current">{ICONS[item.key]}</svg>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
