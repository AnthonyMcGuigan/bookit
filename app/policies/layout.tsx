import Link from "next/link";
import { SiteShell } from "@/components/layout/site-header";

export default function PoliciesLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteShell>
      <div className="mx-auto max-w-3xl">
        <nav aria-label="Policies" className="mb-4 flex flex-wrap gap-3 text-sm">
          <Link href="/policies/content" className="text-accent">Content policy</Link>
          <Link href="/policies/guidelines" className="text-accent">Creator guidelines</Link>
          <Link href="/policies/ip" className="text-accent">IP &amp; takedowns</Link>
        </nav>
        <article className="policy space-y-4 text-sm leading-relaxed [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-text/90">
          {children}
        </article>
      </div>
    </SiteShell>
  );
}
