import { calculateQuote } from "../domain/calculate.ts";
import { formatDate } from "../domain/common.ts";
import { addressLines } from "../domain/customer.ts";
import { formatMoney, formatNumber, formatPercent } from "../domain/money.ts";
import type { Quote } from "../domain/quote.ts";
import type { Settings } from "../domain/settings.ts";
import { type Locale, pick } from "../i18n/locale.ts";

/**
 * The quote as the customer receives it: one A4 document in the look of the
 * Organization's design system, its labels in `locale`. Internal fields
 * (purchase prices, margins, lines waiting for a check, the internal note)
 * never appear here.
 */
export function QuoteDocument({
  quote,
  settings,
  locale = "cs",
}: {
  quote: Quote;
  settings: Settings;
  locale?: Locale;
}) {
  const t = (cs: string, en: string) => pick(locale, cs, en);
  const totals = calculateQuote(quote, settings);
  const money = (amount: number) => formatMoney(amount, quote.currency, locale);
  const percent = (value: number) => formatPercent(value, locale);
  const supplier = settings.supplier;
  const customer = quote.customer;
  const anyDiscount = quote.lines.some((line) => (line.discount_percent ?? 0) > 0);
  return (
    <article className="doc" lang={locale}>
      <header className="doc-head">
        <div className="doc-brand">
          <span className="doc-dot" aria-hidden="true" />
          <span>{supplier.name}</span>
        </div>
        <div className="doc-title">
          <p className="doc-eyebrow">{t("Cenová nabídka", "Quote")}</p>
          <h1 className="doc-number">{quote.number}</h1>
          <p className="doc-version">
            {t("Verze", "Version")} {quote.version}
          </p>
        </div>
      </header>

      <section className="doc-parties">
        <div className="doc-lines-of">
          <h2>{t("Dodavatel", "Supplier")}</h2>
          <p className="doc-party-name">{supplier.name}</p>
          {addressLines(supplier).map((line) => (
            <p key={line}>{line}</p>
          ))}
          {supplier.company_id ? (
            <p>
              {t("IČO", "Company ID")}: {supplier.company_id}
            </p>
          ) : null}
          {supplier.vat_id ? (
            <p>
              {t("DIČ", "VAT ID")}: {supplier.vat_id}
            </p>
          ) : null}
          {supplier.email ? <p>{supplier.email}</p> : null}
          {supplier.phone ? <p>{supplier.phone}</p> : null}
        </div>
        <div className="doc-lines-of">
          <h2>{t("Odběratel", "Customer")}</h2>
          <p className="doc-party-name">{customer.name}</p>
          {addressLines(customer).map((line) => (
            <p key={line}>{line}</p>
          ))}
          {customer.company_id ? (
            <p>
              {t("IČO", "Company ID")}: {customer.company_id}
            </p>
          ) : null}
          {customer.vat_id ? (
            <p>
              {t("DIČ", "VAT ID")}: {customer.vat_id}
            </p>
          ) : null}
          {customer.contact_person ? (
            <p>
              {t("K rukám", "Attn.")}: {customer.contact_person}
            </p>
          ) : null}
        </div>
        <dl className="doc-meta">
          <dt>{t("Vystaveno", "Issued")}</dt>
          <dd>{formatDate(quote.issue_date, locale)}</dd>
          <dt>{t("Platí do", "Valid until")}</dt>
          <dd>{formatDate(quote.valid_until, locale)}</dd>
          {quote.prepared_by ? (
            <>
              <dt>{t("Vypracoval(a)", "Prepared by")}</dt>
              <dd>{quote.prepared_by}</dd>
            </>
          ) : null}
          <dt>{t("Měna", "Currency")}</dt>
          <dd>{quote.currency}</dd>
        </dl>
      </section>

      <h2 className="doc-subject">{quote.title}</h2>
      {quote.introduction ? <p className="doc-intro">{quote.introduction}</p> : null}

      <table className="doc-table">
        <thead>
          <tr>
            <th className="pos">#</th>
            <th>{t("Položka", "Item")}</th>
            <th className="num">{t("Množství", "Quantity")}</th>
            <th className="num">{t("Cena za MJ", "Unit price")}</th>
            {anyDiscount ? <th className="num">{t("Sleva", "Discount")}</th> : null}
            <th className="num">{t("DPH", "VAT")}</th>
            <th className="num">{t("Celkem bez DPH", "Total excl. VAT")}</th>
          </tr>
        </thead>
        <tbody>
          {quote.lines.map((line, index) => {
            const amounts = totals.lines[index];
            return (
              <tr key={line.id}>
                <td className="pos">{index + 1}</td>
                <td>
                  <div className="doc-line-name">{line.name}</div>
                  {line.description ? (
                    <div className="doc-line-detail">{line.description}</div>
                  ) : null}
                  {line.item_code ? <div className="doc-line-detail">{line.item_code}</div> : null}
                </td>
                <td className="num">
                  {formatNumber(line.quantity, locale)} {line.unit}
                </td>
                <td className="num">{money(line.unit_price)}</td>
                {anyDiscount ? (
                  <td className="num">
                    {line.discount_percent ? percent(line.discount_percent) : ""}
                  </td>
                ) : null}
                <td className="num">{percent(line.vat_percent)}</td>
                <td className="num">{money(amounts?.net ?? 0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <section className="doc-summary">
        <table className="doc-table doc-vat">
          <thead>
            <tr>
              <th>{t("Sazba DPH", "VAT rate")}</th>
              <th className="num">{t("Základ", "Base")}</th>
              <th className="num">{t("DPH", "VAT")}</th>
              <th className="num">{t("Celkem", "Total")}</th>
            </tr>
          </thead>
          <tbody>
            {totals.groups.map((group) => (
              <tr key={group.percent}>
                <td>{percent(group.percent)}</td>
                <td className="num">{money(group.base)}</td>
                <td className="num">{money(group.vat)}</td>
                <td className="num">{money(group.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="doc-sum">
          {totals.quoteDiscount > 0 ? (
            <>
              <dt>{t("Mezisoučet", "Subtotal")}</dt>
              <dd>{money(totals.subtotal)}</dd>
              <dt>
                {t("Sleva na nabídku", "Discount on the quote")}{" "}
                {percent(quote.discount_percent ?? 0)}
              </dt>
              <dd>−{money(totals.quoteDiscount)}</dd>
            </>
          ) : null}
          <dt>{t("Celkem bez DPH", "Total excl. VAT")}</dt>
          <dd>{money(totals.base)}</dd>
          <dt>{t("DPH", "VAT")}</dt>
          <dd>{money(totals.vat)}</dd>
          {totals.rounding !== 0 ? (
            <>
              <dt>{t("Zaokrouhlení", "Rounding")}</dt>
              <dd>{money(totals.rounding)}</dd>
            </>
          ) : null}
          <dt className="doc-payable">{t("Celkem s DPH", "Total incl. VAT")}</dt>
          <dd className="doc-payable">{money(totals.payable)}</dd>
        </dl>
      </section>

      {quote.terms ? (
        <section className="doc-terms">
          <h2>{t("Podmínky", "Terms")}</h2>
          <p>{quote.terms}</p>
        </section>
      ) : null}

      <footer className="doc-foot">
        <span>{supplier.name}</span>
        {supplier.registration ? <span>{supplier.registration}</span> : null}
        {supplier.bank_account ? (
          <span>
            {t("Účet", "Account")}: {supplier.bank_account}
          </span>
        ) : null}
        {supplier.web ? <span>{supplier.web}</span> : null}
      </footer>
    </article>
  );
}
