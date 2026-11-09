import { Alert, Button, Table } from "design-system/react";
import { useState } from "react";
import { calculateQuote } from "../../domain/calculate.ts";
import { checkQuote, readyToSend } from "../../domain/checks.ts";
import { localToday } from "../../domain/common.ts";
import { quoteEmail } from "../../domain/email.ts";
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
import { useFormat, useLocale, useT } from "../i18n.tsx";
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
  const t = useT();
  const locale = useLocale();
  const f = useFormat();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [copied, setCopied] = useState(false);
  const stored = data.quotes.find((entry) => idOfQuote(entry.value) === id);
  if (!stored) {
    return (
      <section>
        <PageHeader title={t("Nabídka neexistuje", "This quote does not exist")} />
        <p>
          <a href={href({ page: "quotes", status: null })}>
            {t("Zpět na nabídky", "Back to the quotes")}
          </a>
        </p>
      </section>
    );
  }
  const quote = stored.value;
  const settings = data.settings.value;
  const money = (amount: number) => f.money(amount, quote.currency);
  const totals = calculateQuote(quote, settings);
  const versions = data.quotes
    .map((entry) => entry.value)
    .filter((entry) => entry.number === quote.number)
    .sort((left, right) => left.version - right.version);
  const latest = versions.at(-1);
  const isLatest = latest?.version === quote.version;
  const issues = checkQuote(
    quote,
    {
      settings,
      items: data.items.map((entry) => entry.value),
      customers: data.customers.map((entry) => entry.value),
      versions,
      today,
    },
    f.locale,
  );
  const email = quoteEmail(quote, settings, f.locale);
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
        eyebrow={t(
          `Nabídka · verze ${quote.version} z ${versions.length}`,
          `Quote · version ${quote.version} of ${versions.length}`,
        )}
        title={
          <>
            <span className="code-title">{quote.number}</span> {quote.title}
          </>
        }
        actions={
          <>
            <Button variant="secondary" href={printUrl(id)} icon="page">
              {t("Tisk a PDF", "Print and PDF")}
            </Button>
            {quote.status === "draft" ? (
              <Button variant="primary" href={href({ page: "edit-quote", id })}>
                {t("Upravit", "Edit")}
              </Button>
            ) : null}
            {isLatest && canCreateVersion(quote) ? (
              <Button
                variant="secondary"
                type="button"
                disabled={busy}
                onClick={() => run(() => api.newVersion(id))}
              >
                {t("Upravit jako novou verzi", "Edit as a new version")}
              </Button>
            ) : null}
          </>
        }
      />
      <div className="meta-row">
        <StatusChip status={quote.status} />
        <span>
          <a href={href({ page: "customer", id: quote.customer.id })}>{quote.customer.name}</a>
        </span>
        <span className="muted">
          {t("Vystaveno", "Issued")} {f.date(quote.issue_date)}
        </span>
        <span className="muted">
          {t("Platí do", "Valid until")} {f.date(quote.valid_until)}
        </span>
        {quote.sent_at ? (
          <span className="muted">
            {t("Odesláno", "Sent")} {f.date(quote.sent_at)}
          </span>
        ) : null}
        {quote.prepared_by ? (
          <span className="muted">
            {t("Vypracoval(a)", "Prepared by")} {quote.prepared_by}
          </span>
        ) : null}
      </div>

      <ErrorNotice error={error} />
      {!isLatest && latest ? (
        <Alert tone="info" locale={locale}>
          {t("Toto je starší verze. Platná je", "This is an older version. The current one is")}{" "}
          <a href={href({ page: "quote", id: idOfQuote(latest) })}>
            {t("verze", "version")} {latest.version}
          </a>
          .
        </Alert>
      ) : null}
      {isLatest && isPastValidity(quote, today) ? (
        <Alert tone="warning" locale={locale}>
          {t(
            `Platnost skončila ${f.date(quote.valid_until)} a zákazník se neozval. Označte nabídku jako propadlou, nebo z ní vytvořte novou verzi.`,
            `The quote expired on ${f.date(quote.valid_until)} without an answer. Mark it as expired, or create a new version of it.`,
          )}
        </Alert>
      ) : null}

      <div className="quote-layout">
        <div>
          <Table id="quote-lines" caption={t("Položky nabídky", "Lines of the quote")} hideCaption>
            <thead>
              <tr>
                <th>#</th>
                <th>{t("Položka", "Item")}</th>
                <th className="ds-table__num">{t("Množství", "Quantity")}</th>
                <th className="ds-table__num">{t("Cena za MJ", "Unit price")}</th>
                <th className="ds-table__num">{t("Sleva", "Discount")}</th>
                <th className="ds-table__num">{t("DPH", "VAT")}</th>
                <th className="ds-table__num">{t("Bez DPH", "Excl. VAT")}</th>
                <th className="ds-table__num">{t("Marže", "Margin")}</th>
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
                          <a href={href({ page: "item", code: line.item_code })}>
                            {line.item_code}
                          </a>
                        ) : (
                          t("mimo ceník", "not in the price list")
                        )}
                        {line.description ? ` · ${line.description}` : ""}
                      </div>
                      {line.to_check ? (
                        <div className="warning small">⚠ {line.to_check}</div>
                      ) : null}
                    </td>
                    <td className="ds-table__num">
                      {f.number(line.quantity)} {line.unit}
                    </td>
                    <td className="ds-table__num">{money(line.unit_price)}</td>
                    <td className="ds-table__num">
                      {line.discount_percent ? f.percent(line.discount_percent) : ""}
                    </td>
                    <td className="ds-table__num">{f.percent(line.vat_percent)}</td>
                    <td className="ds-table__num">{money(amounts?.net ?? 0)}</td>
                    <td
                      className={`ds-table__num ${margin !== null && margin < 0 ? "danger" : "muted"}`}
                    >
                      {margin === null ? "" : money(margin)}
                    </td>
                  </tr>
                );
              })}
              {quote.lines.length === 0 ? (
                <tr>
                  <td colSpan={8} className="muted">
                    {t("Nabídka zatím nemá žádnou položku.", "The quote has no line yet.")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </Table>
          <Totals
            totals={totals}
            currency={quote.currency}
            discountPercent={quote.discount_percent}
          />
          {quote.introduction || quote.terms || quote.internal_note ? (
            <article className="ds-card">
              {quote.introduction ? (
                <>
                  <h3>{t("Úvodní text", "Introduction")}</h3>
                  <p className="pre">{quote.introduction}</p>
                </>
              ) : null}
              {quote.terms ? (
                <>
                  <h3>{t("Podmínky", "Terms")}</h3>
                  <p className="pre">{quote.terms}</p>
                </>
              ) : null}
              {quote.internal_note ? (
                <>
                  <h3>{t("Interní poznámka", "Internal note")}</h3>
                  <p className="pre muted">{quote.internal_note}</p>
                </>
              ) : null}
            </article>
          ) : null}
        </div>

        <aside className="aside">
          {actions.length > 0 ? (
            <article className="ds-card">
              <h2>{t("Stav nabídky", "State of the quote")}</h2>
              <div className="stack">
                {actions.map((action) => (
                  <Button
                    key={action}
                    variant={action === "send" ? "primary" : "secondary"}
                    block
                    busy={busy}
                    disabled={action === "send" && !ready}
                    onClick={() => act(action)}
                  >
                    {t.of(ACTION_LABELS[action])}
                  </Button>
                ))}
              </div>
              {actions.includes("send") ? (
                <p className="small muted">
                  {t(
                    "Aplikace nabídku neposílá. Pošlete ji zákazníkovi sami (PDF a text níže) a pak ji tady označte jako odeslanou; tím se tato verze uzamkne.",
                    "The App does not send the quote. Send it to the customer yourself (the PDF and the text below), then mark it as sent here; this locks the version.",
                  )}
                </p>
              ) : null}
            </article>
          ) : null}

          {quote.status === "draft" ? (
            <article className="ds-card">
              <h2>{t("Kontrola před odesláním", "Check before sending")}</h2>
              {issues.length === 0 ? (
                <p className="ok">
                  {t("Nabídka je připravená k odeslání.", "The quote is ready to go out.")}
                </p>
              ) : (
                <ul className="issues">
                  {issues.map((issue) => (
                    <li
                      key={`${issue.code}:${issue.line ?? ""}`}
                      className={`issue issue-${issue.severity}`}
                    >
                      <span className="issue-mark">
                        {issue.severity === "error" ? t("Chyba", "Error") : t("Pozor", "Warning")}
                      </span>{" "}
                      {issue.message}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ) : null}

          <article className="ds-card">
            <h2>{t("E-mail pro zákazníka", "E-mail for the customer")}</h2>
            <p className="small muted">
              {t("Komu", "To")}:{" "}
              {email.to ?? t("zákazník nemá e-mail", "the customer has no e-mail")} ·{" "}
              {t("příloha", "attachment")} {email.attachment}
            </p>
            <p className="email-subject">{email.subject}</p>
            <p className="pre email-body">{email.body}</p>
            <Button variant="secondary" type="button" onClick={copyEmail}>
              {copied ? t("Zkopírováno", "Copied") : t("Zkopírovat text", "Copy the text")}
            </Button>
          </article>

          <article className="ds-card">
            <h2>{t("Verze", "Versions")}</h2>
            <ul className="versions">
              {versions.map((version) => (
                <li key={version.version}>
                  <a href={href({ page: "quote", id: idOfQuote(version) })}>
                    {t("Verze", "Version")} {version.version}
                  </a>{" "}
                  <StatusChip status={version.status} />{" "}
                  <span className="muted small">{f.date(version.issue_date)}</span>
                  {version.version === quote.version ? (
                    <span className="muted small"> · {t("zobrazená", "shown")}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </article>
        </aside>
      </div>
    </section>
  );
}
