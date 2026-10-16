import type { Metadata } from "next";
import Link from "next/link";
import { getUniverseState } from "@/lib/game/load";
import { indexById, playerPromotions } from "@/lib/domain/selectors";
import { TRANSACTION_CATEGORY_LABELS, SHOW_TYPE_LABELS } from "@/lib/domain/enums";
import { formatGameDate } from "@/lib/domain/dates";
import { Alert, Card, CardHeader, Field, Input, PageHeader, Select, Stat, formatMoney } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { adjustCashAction } from "@/features/finances/actions";

export const metadata: Metadata = { title: "Finances" };

export default async function FinancesPage({ params }: { params: Promise<{ universeId: string }> }) {
  const { universeId } = await params;
  const state = await getUniverseState(universeId);
  const base = `/u/${universeId}`;
  const settings = state.universe.settings;
  if (!settings.financesEnabled) {
    return (
      <>
        <PageHeader title="Finances" back={{ href: `${base}/more`, label: "More" }} />
        <Alert title="Finances are off">This universe ignores money entirely. Turn finances on in <Link href={`${base}/settings`} className="underline">settings</Link> to track ticket sales, payroll and deals.</Alert>
      </>
    );
  }
  const currency = settings.currency;
  const promotions = playerPromotions(state);
  const shows = indexById(state.shows);
  const tx = state.financialTransactions.slice().sort((a, b) => (a.occurred_on < b.occurred_on ? 1 : a.occurred_on > b.occurred_on ? -1 : 0));
  return (
    <>
      <PageHeader title="Finances" subtitle="Last 120 days of activity" back={{ href: `${base}/more`, label: "More" }} />
      {promotions.map((p) => {
        const mine = tx.filter((t) => t.promotion_id === p.id);
        const revenue = mine.filter((t) => t.amount > 0 && t.category !== "starting_capital").reduce((s, t) => s + t.amount, 0);
        const expenses = mine.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);
        const byCat = new Map<string, number>();
        for (const t of mine) if (t.category !== "starting_capital") byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount);
        const deals = state.businessDeals.filter((d) => d.promotion_id === p.id && d.status === "active");
        return (
          <section key={p.id} className="mb-6">
            <h2 className="mb-2 font-semibold">{p.name}</h2>
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Cash" value={<span className={p.cash_balance < 0 ? "text-danger" : ""}>{formatMoney(p.cash_balance, currency)}</span>} />
              <Stat label="Revenue" value={<span className="text-success">{formatMoney(revenue, currency)}</span>} />
              <Stat label="Expenses" value={<span className="text-danger">{formatMoney(expenses, currency)}</span>} />
              <Stat label="Net" value={<span className={revenue + expenses < 0 ? "text-danger" : "text-success"}>{formatMoney(revenue + expenses, currency)}</span>} />
            </div>
            {p.cash_balance < 0 && <div className="mb-4"><Alert tone="danger">You&apos;re in debt. Cut payroll, run cheaper shows or book bigger draws.</Alert></div>}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader title="By category" />
                <ul className="divide-y divide-border">
                  {[...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([cat, amount]) => (
                    <li key={cat} className="flex justify-between px-4 py-1.5 text-sm"><span>{TRANSACTION_CATEGORY_LABELS[cat as keyof typeof TRANSACTION_CATEGORY_LABELS] ?? cat}</span><span className={amount < 0 ? "text-danger" : "text-success"}>{formatMoney(amount, currency)}</span></li>
                  ))}
                  {byCat.size === 0 && <li className="p-4 text-sm text-muted">No activity yet.</li>}
                </ul>
              </Card>
              <Card>
                <CardHeader title="Deals" />
                <ul className="divide-y divide-border">
                  {deals.map((d) => (
                    <li key={d.id} className="px-4 py-2 text-sm">
                      <p className="font-medium">{d.partner_name} <span className="text-xs font-normal capitalize text-muted">({d.kind})</span></p>
                      <p className="text-xs text-muted">{formatMoney(d.amount_per_show, currency)} per {d.applies_to.map((a) => SHOW_TYPE_LABELS[a]).join(" / ")} · until {formatGameDate(d.ends_on)}</p>
                    </li>
                  ))}
                  {deals.length === 0 && <li className="p-4 text-sm text-muted">No active deals.</li>}
                </ul>
              </Card>
            </div>
          </section>
        );
      })}
      <Card className="mb-6">
        <CardHeader title="Ledger" />
        <ul className="divide-y divide-border">
          {tx.slice(0, 80).map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span className="w-20 shrink-0 text-xs text-muted">{formatGameDate(t.occurred_on)}</span>
              <span className="min-w-0 flex-1 truncate">
                {t.description}
                {t.show_id && shows.get(t.show_id) && <span className="block truncate text-xs text-muted">{shows.get(t.show_id)!.name}</span>}
              </span>
              <span className={t.amount < 0 ? "shrink-0 text-danger" : "shrink-0 text-success"}>{formatMoney(t.amount, currency)}</span>
            </li>
          ))}
          {tx.length === 0 && <li className="p-4 text-sm text-muted">No transactions in the last 120 days.</li>}
        </ul>
      </Card>
      <Card>
        <CardHeader title="Manual adjustment" subtitle="For sandbox play or house rules. Recorded in the ledger." />
        <div className="p-4">
          <ActionForm action={adjustCashAction} submitLabel="Record adjustment" submitVariant="secondary" resetOnSuccess>
            <input type="hidden" name="universeId" value={universeId} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Promotion" htmlFor="adj-p"><Select id="adj-p" name="promotion_id">{state.promotions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
              <Field label="Amount (negative to deduct)" htmlFor="adj-a"><Input id="adj-a" name="amount" type="number" required /></Field>
              <Field label="Description" htmlFor="adj-d"><Input id="adj-d" name="description" maxLength={300} required /></Field>
            </div>
          </ActionForm>
        </div>
      </Card>
    </>
  );
}
