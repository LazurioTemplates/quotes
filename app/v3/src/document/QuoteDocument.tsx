import { calculateQuote } from "../domain/calculate.ts";
import { formatDate } from "../domain/common.ts";
import { addressLines } from "../domain/customer.ts";
import { formatMoney, formatNumber, formatPercent } from "../domain/money.ts";
import type { Quote } from "../domain/quote.ts";
import type { Settings } from "../domain/settings.ts";

/**
 * The quote as the customer receives it: one A4 document in the look of the
 * Organization's design system. Internal fields (purchase prices, margins,
 * lines waiting for a check, the internal note) never appear here.
 */
export function QuoteDocument({ quote, settings }: { quote: Quote; settings: Settings }) {
  const totals = calculateQuote(quote, settings);
  const money = (amount: number) => formatMoney(amount, quote.currency);
  const supplier = settings.supplier;
  const customer = quote.customer;
  const anyDiscount = quote.lines.some((line) => (line.discount_percent ?? 0) > 0);
  return (
    <article className="doc" lang="cs">
      <header className="doc-head">
        <div className="doc-brand">
          <span className="doc-dot" aria-hidden="true" />
          <span>{supplier.name}</span>
        </div>
        <div className="doc-title">
          <p className="doc-eyebrow">Cenová nabídka</p>
          <h1 className="doc-number">{quote.number}</h1>
          <p className="doc-version">Verze {quote.version}</p>
          {quote.status === "draft" ? <p className="doc-draft">Koncept</p> : null}
        </div>
      </header>

      <section className="doc-parties">
        <div className="doc-lines-of">
          <h2>Dodavatel</h2>
          <p className="doc-party-name">{supplier.name}</p>
          {addressLines(supplier).map((line) => (
            <p key={line}>{line}</p>
          ))}
          {supplier.company_id ? <p>IČO: {supplier.company_id}</p> : null}
          {supplier.vat_id ? <p>DIČ: {supplier.vat_id}</p> : null}
          {supplier.email ? <p>{supplier.email}</p> : null}
          {supplier.phone ? <p>{supplier.phone}</p> : null}
        </div>
        <div className="doc-lines-of">
          <h2>Odběratel</h2>
          <p className="doc-party-name">{customer.name}</p>
          {addressLines(customer).map((line) => (
            <p key={line}>{line}</p>
          ))}
          {customer.company_id ? <p>IČO: {customer.company_id}</p> : null}
          {customer.vat_id ? <p>DIČ: {customer.vat_id}</p> : null}
          {customer.contact_person ? <p>K rukám: {customer.contact_person}</p> : null}
        </div>
        <dl className="doc-meta">
          <dt>Vystaveno</dt>
          <dd>{formatDate(quote.issue_date)}</dd>
          <dt>Platí do</dt>
          <dd>{formatDate(quote.valid_until)}</dd>
          {quote.prepared_by ? (
            <>
              <dt>Vypracoval(a)</dt>
              <dd>{quote.prepared_by}</dd>
            </>
          ) : null}
          <dt>Měna</dt>
          <dd>{quote.currency}</dd>
        </dl>
      </section>

      <h2 className="doc-subject">{quote.title}</h2>
      {quote.introduction ? <p className="doc-intro">{quote.introduction}</p> : null}

      <table className="doc-table">
        <thead>
          <tr>
            <th className="pos">#</th>
            <th>Položka</th>
            <th className="num">Množství</th>
            <th className="num">Cena za MJ</th>
            {anyDiscount ? <th className="num">Sleva</th> : null}
            <th className="num">DPH</th>
            <th className="num">Celkem bez DPH</th>
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
                  {line.description ? <div className="doc-line-detail">{line.description}</div> : null}
                  {line.item_code ? <div className="doc-line-detail">{line.item_code}</div> : null}
                </td>
                <td className="num">
                  {formatNumber(line.quantity)} {line.unit}
                </td>
                <td className="num">{money(line.unit_price)}</td>
                {anyDiscount ? (
                  <td className="num">
                    {line.discount_percent ? formatPercent(line.discount_percent) : ""}
                  </td>
                ) : null}
                <td className="num">{formatPercent(line.vat_percent)}</td>
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
              <th>Sazba DPH</th>
              <th className="num">Základ</th>
              <th className="num">DPH</th>
              <th className="num">Celkem</th>
            </tr>
          </thead>
          <tbody>
            {totals.groups.map((group) => (
              <tr key={group.percent}>
                <td>{formatPercent(group.percent)}</td>
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
              <dt>Mezisoučet</dt>
              <dd>{money(totals.subtotal)}</dd>
              <dt>Sleva na nabídku {formatPercent(quote.discount_percent ?? 0)}</dt>
              <dd>−{money(totals.quoteDiscount)}</dd>
            </>
          ) : null}
          <dt>Celkem bez DPH</dt>
          <dd>{money(totals.base)}</dd>
          <dt>DPH</dt>
          <dd>{money(totals.vat)}</dd>
          {totals.rounding !== 0 ? (
            <>
              <dt>Zaokrouhlení</dt>
              <dd>{money(totals.rounding)}</dd>
            </>
          ) : null}
          <dt className="doc-payable">Celkem s DPH</dt>
          <dd className="doc-payable">{money(totals.payable)}</dd>
        </dl>
      </section>

      {quote.terms ? (
        <section className="doc-terms">
          <h2>Podmínky</h2>
          <p>{quote.terms}</p>
        </section>
      ) : null}

      <footer className="doc-foot">
        <span>{supplier.name}</span>
        {supplier.registration ? <span>{supplier.registration}</span> : null}
        {supplier.bank_account ? <span>Účet: {supplier.bank_account}</span> : null}
        {supplier.web ? <span>{supplier.web}</span> : null}
      </footer>
    </article>
  );
}
