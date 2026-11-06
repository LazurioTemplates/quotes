import type { QuoteTotals } from "../../domain/calculate.ts";
import { useFormat, useT } from "../i18n.tsx";

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
  const t = useT();
  const f = useFormat();
  const money = (amount: number) => f.money(amount, currency);
  return (
    <div className="totals">
      <dl className="sum">
        <dt>{t("Mezisoučet", "Subtotal")}</dt>
        <dd>{money(totals.subtotal)}</dd>
        {totals.quoteDiscount > 0 ? (
          <>
            <dt>
              {t("Sleva na nabídku", "Discount on the quote")} {f.percent(discountPercent ?? 0)}
            </dt>
            <dd>−{money(totals.quoteDiscount)}</dd>
          </>
        ) : null}
        <dt>{t("Celkem bez DPH", "Total excl. VAT")}</dt>
        <dd>{money(totals.base)}</dd>
        {totals.groups.map((group) => (
          <FragmentRow
            key={group.percent}
            label={t(
              `DPH ${f.percent(group.percent)} ze ${money(group.base)}`,
              `VAT ${f.percent(group.percent)} of ${money(group.base)}`,
            )}
            value={money(group.vat)}
          />
        ))}
        {totals.rounding !== 0 ? (
          <>
            <dt>{t("Zaokrouhlení", "Rounding")}</dt>
            <dd>{money(totals.rounding)}</dd>
          </>
        ) : null}
        <dt className="sum-total">{t("Celkem s DPH", "Total incl. VAT")}</dt>
        <dd className="sum-total">{money(totals.payable)}</dd>
      </dl>
      {showMargin && totals.margin ? (
        <p className="margin muted">
          {t(
            `Marže ${money(totals.margin.amount)} (${f.percent(totals.margin.percent)}) z řádků s nákupní cenou · jen pro vás, do dokumentu se netiskne`,
            `Margin ${money(totals.margin.amount)} (${f.percent(totals.margin.percent)}) on the lines with a purchase price · for you only, never printed`,
          )}
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
