import { calculateQuote } from "../../domain/calculate.ts";
import { localToday } from "../../domain/common.ts";
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
import { useFormat, useT } from "../i18n.tsx";
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
  const t = useT();
  const f = useFormat();
  const settings = data.settings.value;
  const latest = latestVersions(data.quotes.map((entry) => entry.value));
  const shown = status ? latest.filter((quote) => quote.status === status) : latest;
  const count = (value: QuoteStatus) => latest.filter((quote) => quote.status === value).length;
  return (
    <section>
      <PageHeader
        title={t("Nabídky", "Quotes")}
        subtitle={t(
          "Poslední verze každé nabídky. Starší verze najdete v detailu nabídky.",
          "The latest version of every quote. Older versions are in the quote's detail.",
        )}
        actions={
          <a className="button button-primary" href={href({ page: "new-quote" })}>
            {t("Nová nabídka", "New quote")}
          </a>
        }
      />
      <nav className="filters" aria-label={t("Stav nabídky", "State of the quote")}>
        <a
          className={`filter${status === null ? " active" : ""}`}
          href={href({ page: "quotes", status: null })}
        >
          {t("Všechny", "All")} ({latest.length})
        </a>
        {QUOTE_STATUSES.map((value) => (
          <a
            key={value}
            className={`filter${status === value ? " active" : ""}`}
            href={href({ page: "quotes", status: value })}
          >
            {t.of(STATUS_LABELS[value])} ({count(value)})
          </a>
        ))}
      </nav>
      {shown.length === 0 ? (
        <p className="panel empty muted">
          {t("Žádná nabídka v tomto stavu.", "No quote in this state.")}
        </p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>{t("Číslo", "Number")}</th>
              <th>{t("Předmět", "Subject")}</th>
              <th>{t("Zákazník", "Customer")}</th>
              <th>{t("Stav", "State")}</th>
              <th>{t("Platí do", "Valid until")}</th>
              <th className="num">{t("Celkem s DPH", "Total incl. VAT")}</th>
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
                      <span className="chip chip-warning">
                        {t("po platnosti", "past validity")}
                      </span>
                    ) : null}
                  </td>
                  <td>{f.date(quote.valid_until)}</td>
                  <td className="num">
                    {f.money(calculateQuote(quote, settings).payable, quote.currency)}
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
