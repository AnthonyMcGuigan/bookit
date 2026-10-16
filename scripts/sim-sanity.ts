import { buildStarterUniverse } from "@/lib/seed/starter";
const t = Date.now();
const s = buildStarterUniverse({ name: "Sanity" });
console.log("built in", Date.now() - t, "ms");
for (const sh of s.shows.filter((x) => x.status === "completed").slice(-6)) console.log(sh.name, sh.rating, sh.attendance);
const mom = s.wrestlers.map((w) => w.momentum).sort((a, b) => b - a);
console.log("momentum top/bottom", mom.slice(0, 5), mom.slice(-3));
console.log("storylines", s.storylines.map((x) => `${x.title}:${x.intensity}:${x.status}`));
console.log("cash", s.promotions.map((p) => `${p.abbreviation}:${p.cash_balance}`));
