import type { QuoteTotals } from "../../domain/calculate.ts";
import { formatMoney, formatPercent } from "../../domain/money.ts";

/** The sums of a quote with the VAT per rate, and the margin for the Organization's eyes only. */
export function Totals({
  totals,
  currency,
  discountPercent,
  showMargin = true,
}: {
  totals: QuoteTotals;
  currency: string;
  discountPercent?: number | undefined;
  showMargin?: boolean;
}) {
  const money = (amount: number) => formatMoney(amount, currency);
  return (
    <div className="totals">
      <dl className="sum">
        <dt>Mezisoučet</dt>
        <dd>{money(totals.subtotal)}</dd>
        {totals.quoteDiscount > 0 ? (
          <>
            <dt>Sleva na nabídku {formatPercent(discountPercent ?? 0)}</dt>
            <dd>−{money(totals.quoteDiscount)}</dd>
          </>
        ) : null}
        <dt>Celkem bez DPH</dt>
        <dd>{money(totals.base)}</dd>
        {totals.groups.map((group) => (
          <FragmentRow
            key={group.percent}
            label={`DPH ${formatPercent(group.percent)} ze ${money(group.base)}`}
            value={money(group.vat)}
          />
        ))}
        {totals.rounding !== 0 ? (
          <>
            <dt>Zaokrouhlení</dt>
            <dd>{money(totals.rounding)}</dd>
          </>
        ) : null}
        <dt className="sum-total">Celkem s DPH</dt>
        <dd className="sum-total">{money(totals.payable)}</dd>
      </dl>
      {showMargin && totals.margin ? (
        <p className="margin muted">
          Marže {money(totals.margin.amount)} ({formatPercent(totals.margin.percent)}) z řádků s
          nákupní cenou · jen pro vás, do dokumentu se netiskne
        </p>
      ) : null}
    </div>
  );
}

function FragmentRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}
