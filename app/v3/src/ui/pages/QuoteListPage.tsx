import { calculateQuote } from "../../domain/calculate.ts";
import { formatDate, localToday } from "../../domain/common.ts";
import { formatMoney } from "../../domain/money.ts";
import {
  idOfQuote,
  isPastValidity,
  latestVersions,
  QUOTE_STATUSES,
  type QuoteStatus,
  STATUS_LABELS,
} from "../../domain/quote.ts";
import type { AppData } from "../App.tsx";
import { PageHeader, StatusChip } from "../components/common.tsx";
import { href } from "../routes.ts";

export function QuoteListPage({
  data,
  status,
  today = localToday(),
}: {
  data: AppData;
  status: QuoteStatus | null;
  today?: string;
}) {
  const settings = data.settings.value;
  const latest = latestVersions(data.quotes.map((entry) => entry.value));
  const shown = status ? latest.filter((quote) => quote.status === status) : latest;
  const count = (value: QuoteStatus) => latest.filter((quote) => quote.status === value).length;
  return (
    <section>
      <PageHeader
        title="Nabídky"
        subtitle="Poslední verze každé nabídky. Starší verze najdete v detailu nabídky."
        actions={
          <a className="button button-primary" href={href({ page: "new-quote" })}>
            Nová nabídka
          </a>
        }
      />
      <nav className="filters" aria-label="Stav nabídky">
        <a className={`filter${status === null ? " active" : ""}`} href={href({ page: "quotes", status: null })}>
          Všechny ({latest.length})
        </a>
        {QUOTE_STATUSES.map((value) => (
          <a
            key={value}
            className={`filter${status === value ? " active" : ""}`}
            href={href({ page: "quotes", status: value })}
          >
            {STATUS_LABELS[value]} ({count(value)})
          </a>
        ))}
      </nav>
      {shown.length === 0 ? (
        <p className="panel empty muted">Žádná nabídka v tomto stavu.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Číslo</th>
              <th>Předmět</th>
              <th>Zákazník</th>
              <th>Stav</th>
              <th>Platí do</th>
              <th className="num">Celkem s DPH</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((quote) => {
              const id = idOfQuote(quote);
              return (
                <tr key={id}>
                  <td>
                    <a className="code-link" href={href({ page: "quote", id })}>
                      {quote.number}
                    </a>
                    {quote.version > 1 ? <span className="muted"> · v{quote.version}</span> : null}
                  </td>
                  <td>
                    <a href={href({ page: "quote", id })}>{quote.title}</a>
                  </td>
                  <td>{quote.customer.name}</td>
                  <td>
                    <StatusChip status={quote.status} />
                    {isPastValidity(quote, today) ? (
                      <span className="chip chip-warning">po platnosti</span>
                    ) : null}
                  </td>
                  <td>{formatDate(quote.valid_until)}</td>
                  <td className="num">
                    {formatMoney(calculateQuote(quote, settings).payable, quote.currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
