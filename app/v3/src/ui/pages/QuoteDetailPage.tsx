import { useState } from "react";
import { calculateQuote } from "../../domain/calculate.ts";
import { checkQuote, readyToSend } from "../../domain/checks.ts";
import { formatDate, localToday } from "../../domain/common.ts";
import { quoteEmail } from "../../domain/email.ts";
import { formatMoney, formatNumber, formatPercent } from "../../domain/money.ts";
import {
  ACTION_LABELS,
  allowedActions,
  canCreateVersion,
  idOfQuote,
  isPastValidity,
  type QuoteAction,
} from "../../domain/quote.ts";
import type { AppData } from "../App.tsx";
import { api, printUrl } from "../api.ts";
import { ErrorNotice, PageHeader, StatusChip } from "../components/common.tsx";
import { Totals } from "../components/Totals.tsx";
import { href, navigate } from "../routes.ts";

export function QuoteDetailPage({
  data,
  id,
  onChanged,
  today = localToday(),
}: {
  data: AppData;
  id: string;
  onChanged: () => Promise<void>;
  today?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [copied, setCopied] = useState(false);
  const stored = data.quotes.find((entry) => idOfQuote(entry.value) === id);
  if (!stored) {
    return (
      <section>
        <PageHeader title="Nabídka neexistuje" />
        <p>
          <a href={href({ page: "quotes", status: null })}>Zpět na nabídky</a>
        </p>
      </section>
    );
  }
  const quote = stored.value;
  const settings = data.settings.value;
  const money = (amount: number) => formatMoney(amount, quote.currency);
  const totals = calculateQuote(quote, settings);
  const versions = data.quotes
    .map((entry) => entry.value)
    .filter((entry) => entry.number === quote.number)
    .sort((left, right) => left.version - right.version);
  const latest = versions.at(-1);
  const isLatest = latest?.version === quote.version;
  const issues = checkQuote(quote, {
    settings,
    items: data.items.map((entry) => entry.value),
    customers: data.customers.map((entry) => entry.value),
    versions,
    today,
  });
  const email = quoteEmail(quote, settings);
  const actions = isLatest ? allowedActions(quote) : [];
  const ready = readyToSend(issues);

  async function run(operation: () => Promise<{ value: Parameters<typeof idOfQuote>[0] }>) {
    setBusy(true);
    setError(null);
    try {
      const result = await operation();
      await onChanged();
      const next = idOfQuote(result.value);
      if (next !== id) navigate({ page: "quote", id: next });
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }
  const act = (action: QuoteAction) => run(() => api.act(id, action, stored.revision));

  async function copyEmail() {
    await navigator.clipboard?.writeText(`${email.subject}\n\n${email.body}`).catch(() => {});
    setCopied(true);
  }

  return (
    <section>
      <PageHeader
        eyebrow={`Nabídka · verze ${quote.version} z ${versions.length}`}
        title={
          <>
            <span className="code-title">{quote.number}</span> {quote.title}
          </>
        }
        actions={
          <>
            <a className="button" href={printUrl(id)} target="_blank" rel="noreferrer">
              Tisk a PDF
            </a>
            {quote.status === "draft" ? (
              <a className="button button-primary" href={href({ page: "edit-quote", id })}>
                Upravit
              </a>
            ) : null}
            {isLatest && canCreateVersion(quote) ? (
              <button
                className="button"
                type="button"
                disabled={busy}
                onClick={() => run(() => api.newVersion(id))}
              >
                Upravit jako novou verzi
              </button>
            ) : null}
          </>
        }
      />
      <div className="meta-row">
        <StatusChip status={quote.status} />
        <span>
          <a href={href({ page: "customer", id: quote.customer.id })}>{quote.customer.name}</a>
        </span>
        <span className="muted">Vystaveno {formatDate(quote.issue_date)}</span>
        <span className="muted">Platí do {formatDate(quote.valid_until)}</span>
        {quote.sent_at ? <span className="muted">Odesláno {formatDate(quote.sent_at)}</span> : null}
        {quote.prepared_by ? <span className="muted">Vypracoval(a) {quote.prepared_by}</span> : null}
      </div>

      <ErrorNotice error={error} />
      {!isLatest && latest ? (
        <p className="notice notice-info">
          Toto je starší verze. Platná je{" "}
          <a href={href({ page: "quote", id: idOfQuote(latest) })}>verze {latest.version}</a>.
        </p>
      ) : null}
      {isLatest && isPastValidity(quote, today) ? (
        <p className="notice notice-warning">
          Platnost skončila {formatDate(quote.valid_until)} a zákazník se neozval. Označte nabídku
          jako propadlou, nebo z ní vytvořte novou verzi.
        </p>
      ) : null}

      <div className="detail-grid">
        <div>
          <table className="table lines-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Položka</th>
                <th className="num">Množství</th>
                <th className="num">Cena za MJ</th>
                <th className="num">Sleva</th>
                <th className="num">DPH</th>
                <th className="num">Bez DPH</th>
                <th className="num">Marže</th>
              </tr>
            </thead>
            <tbody>
              {quote.lines.map((line, index) => {
                const amounts = totals.lines[index];
                const margin =
                  amounts && amounts.cost !== null ? amounts.base - amounts.cost : null;
                return (
                  <tr key={line.id} className={line.to_check ? "row-warning" : undefined}>
                    <td className="muted">{index + 1}</td>
                    <td>
                      <div>{line.name}</div>
                      <div className="muted small">
                        {line.item_code ? (
                          <a href={href({ page: "item", code: line.item_code })}>{line.item_code}</a>
                        ) : (
                          "mimo ceník"
                        )}
                        {line.description ? ` · ${line.description}` : ""}
                      </div>
                      {line.to_check ? <div className="warning small">⚠ {line.to_check}</div> : null}
                    </td>
                    <td className="num">
                      {formatNumber(line.quantity)} {line.unit}
                    </td>
                    <td className="num">{money(line.unit_price)}</td>
                    <td className="num">
                      {line.discount_percent ? formatPercent(line.discount_percent) : ""}
                    </td>
                    <td className="num">{formatPercent(line.vat_percent)}</td>
                    <td className="num">{money(amounts?.net ?? 0)}</td>
                    <td className={`num ${margin !== null && margin < 0 ? "danger" : "muted"}`}>
                      {margin === null ? "" : money(margin)}
                    </td>
                  </tr>
                );
              })}
              {quote.lines.length === 0 ? (
                <tr>
                  <td colSpan={8} className="muted">
                    Nabídka zatím nemá žádnou položku.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <Totals totals={totals} currency={quote.currency} discountPercent={quote.discount_percent} />
          {quote.introduction || quote.terms || quote.internal_note ? (
            <article className="panel">
              {quote.introduction ? (
                <>
                  <h3>Úvodní text</h3>
                  <p className="pre">{quote.introduction}</p>
                </>
              ) : null}
              {quote.terms ? (
                <>
                  <h3>Podmínky</h3>
                  <p className="pre">{quote.terms}</p>
                </>
              ) : null}
              {quote.internal_note ? (
                <>
                  <h3>Interní poznámka</h3>
                  <p className="pre muted">{quote.internal_note}</p>
                </>
              ) : null}
            </article>
          ) : null}
        </div>

        <aside className="aside">
          {actions.length > 0 ? (
            <article className="panel">
              <h2>Stav nabídky</h2>
              <div className="stack">
                {actions.map((action) => (
                  <button
                    key={action}
                    className={`button${action === "send" ? " button-primary" : ""}`}
                    type="button"
                    disabled={busy || (action === "send" && !ready)}
                    onClick={() => act(action)}
                  >
                    {ACTION_LABELS[action]}
                  </button>
                ))}
              </div>
              {actions.includes("send") ? (
                <p className="small muted">
                  Aplikace nabídku neposílá. Pošlete ji zákazníkovi sami (PDF a text níže) a pak ji
                  tady označte jako odeslanou; tím se tato verze uzamkne.
                </p>
              ) : null}
            </article>
          ) : null}

          {quote.status === "draft" ? (
            <article className="panel">
              <h2>Kontrola před odesláním</h2>
              {issues.length === 0 ? (
                <p className="ok">Nabídka je připravená k odeslání.</p>
              ) : (
                <ul className="issues">
                  {issues.map((issue) => (
                    <li key={`${issue.code}:${issue.line ?? ""}`} className={`issue issue-${issue.severity}`}>
                      <span className="issue-mark">{issue.severity === "error" ? "Chyba" : "Pozor"}</span>{" "}
                      {issue.message}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ) : null}

          <article className="panel">
            <h2>E-mail pro zákazníka</h2>
            <p className="small muted">
              Komu: {email.to ?? "zákazník nemá e-mail"} · příloha {email.attachment}
            </p>
            <p className="email-subject">{email.subject}</p>
            <p className="pre email-body">{email.body}</p>
            <button className="button" type="button" onClick={copyEmail}>
              {copied ? "Zkopírováno" : "Zkopírovat text"}
            </button>
          </article>

          <article className="panel">
            <h2>Verze</h2>
            <ul className="versions">
              {versions.map((version) => (
                <li key={version.version}>
                  <a href={href({ page: "quote", id: idOfQuote(version) })}>
                    Verze {version.version}
                  </a>{" "}
                  <StatusChip status={version.status} />{" "}
                  <span className="muted small">{formatDate(version.issue_date)}</span>
                  {version.version === quote.version ? <span className="muted small"> · zobrazená</span> : null}
                </li>
              ))}
            </ul>
          </article>
        </aside>
      </div>
    </section>
  );
}
