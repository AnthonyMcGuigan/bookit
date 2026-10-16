import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { SiteShell } from "@/components/layout/site-header";
import { LinkButton } from "@/components/ui";

const FEATURES = [
  ["Build a universe", "Start blank, load the fictional starter world, or import a community universe. Every save is private and stored in the cloud."],
  ["Book every show", "Weekly TV, house shows, tournaments and supershows. Order the card, set stipulations and finishes, or let the simulation decide."],
  ["Watch the world react", "Popularity, momentum, morale, fatigue, injuries, chemistry, rivalries and title histories evolve with every booking decision."],
  ["Run the business", "Optional finances: payroll, tickets, merchandise, broadcast deals and rival promotions competing for talent."],
  ["Customize everything", "Upload portraits, logos, title designs and posters. Original placeholder art keeps everything usable without uploads."],
  ["Share with the community", "Publish wrestlers, promotions, storylines and complete universes. Download, rate, remix with attribution."],
];

export default async function Home() {
  if (await getSessionUser()) redirect("/universes");
  return (
    <SiteShell>
      <section className="py-8 sm:py-14">
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">Wrestling management sandbox</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">You control the creative direction. The world reacts.</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">
          Create promotions and entire wrestling universes, book complete shows, simulate matches and careers, and share your creations.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <LinkButton href="/sign-up">Create a free account</LinkButton>
          <LinkButton href="/sign-in" variant="secondary">Sign in</LinkButton>
          <LinkButton href="/community" variant="ghost">Browse community creations</LinkButton>
        </div>
      </section>
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(([title, body]) => (
          <div key={title} className="rounded-xl border border-border bg-surface p-4">
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted">{body}</p>
          </div>
        ))}
      </section>
    </SiteShell>
  );
}
