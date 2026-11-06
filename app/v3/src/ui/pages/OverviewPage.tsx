import { calculateQuote } from "../../domain/calculate.ts";
import { addDays, localToday } from "../../domain/common.ts";
import { idOfQuote, isPastValidity, latestVersions, type Quote } from "../../domain/quote.ts";
import type { AppData } from "../App.tsx";
import { PageHeader, StatusChip } from "../components/common.tsx";
import { useFormat, useT } from "../i18n.tsx";
import { href } from "../routes.ts";

const ITEMS = {
  cs: { one: "položka", few: "položky", many: "položek" },
  en: { one: "item", other: "items" },
};

export function OverviewPage({ data, today = localToday() }: { data: AppData; today?: string }) {
  const t = useT();
  const f = useFormat();
  const settings = data.settings.value;
  const latest = latestVersions(data.quotes.map((entry) => entry.value));
  const payable = (quote: Quote) => calculateQuote(quote, settings).payable;
  const money = (amount: number) => f.money(amount, settings.currency);
  const drafts = latest.filter((quote) => quote.status === "draft");
  const waiting = latest.filter(
    (quote) => quote.status === "sent" && !isPastValidity(quote, today),
  );
  const overdue = latest.filter((quote) => isPastValidity(quote, today));
  const accepted = latest.filter((quote) => quote.status === "accepted");
  const sum = (quotes: readonly Quote[]) =>
    quotes.reduce((total, quote) => total + payable(quote), 0);
  const horizon = addDays(today, 31);
  const active = data.items.filter((entry) => !entry.value.archived);
  const expiring = active.filter(
    (entry) => entry.value.valid_to !== undefined && entry.value.valid_to <= horizon,
  );

  const row = (quote: Quote, note: string) => (
    <a
      key={idOfQuote(quote)}
      className="list-row"
      href={href({ page: "quote", id: idOfQuote(quote) })}
    >
      <span className="list-row-main">
        <span className="code-link">{quote.number}</span>
        <span className="list-row-title">{quote.title}</span>
        <span className="muted small">
          {quote.customer.name} · {note}
        </span>
      </span>
      <StatusChip status={quote.status} />
      <span className="num">{money(payable(quote))}</span>
    </a>
  );
  const validUntil = (quote: Quote) =>
    t(`platí do ${f.date(quote.valid_until)}`, `valid until ${f.date(quote.valid_until)}`);

  return (
    <section>
      <PageHeader
        eyebrow={settings.supplier.name}
        title={t("Přehled nabídek", "Quotes overview")}
        subtitle={t(
          "Co čeká na odpověď zákazníka, co je rozpracované a co je potřeba uzavřít.",
          "What waits for the customer's answer, what is in progress and what needs closing.",
        )}
        actions={
          <a className="button button-primary" href={href({ page: "new-quote" })}>
            {t("Nová nabídka", "New quote")}
          </a>
        }
      />
      <div className="stats">
        <a className="stat" href={href({ page: "quotes", status: "draft" })}>
          <span className="stat-value">{drafts.length}</span>
          <span className="stat-label">{t("Rozpracované koncepty", "Drafts in progress")}</span>
        </a>
        <a className="stat" href={href({ page: "quotes", status: "sent" })}>
          <span className="stat-value">{waiting.length}</span>
          <span className="stat-label">{t("Čekají na odpověď", "Waiting for an answer")}</span>
        </a>
        <div className="stat">
          <span className="stat-value">{money(sum(waiting))}</span>
          <span className="stat-label">
            {t("Hodnota odeslaných nabídek s DPH", "Value of the quotes sent, incl. VAT")}
          </span>
        </div>
        <a className="stat" href={href({ page: "quotes", status: "accepted" })}>
          <span className="stat-value">{accepted.length}</span>
          <span className="stat-label">{t("Přijaté nabídky", "Accepted quotes")}</span>
        </a>
      </div>

      {overdue.length > 0 ? (
        <article className="panel panel-warning">
          <h2>{t("Po platnosti", "Past their validity")}</h2>
          <p className="muted">
            {t(
              "Zákazník se do konce platnosti neozval. Otevřete nabídku a označte ji jako propadlou, nebo z ní vytvořte novou verzi.",
              "The customer did not answer before the quote expired. Open it and mark it as expired, or create a new version of it.",
            )}
          </p>
          <div className="list">
            {overdue.map((quote) =>
              row(
                quote,
                t(
                  `platila do ${f.date(quote.valid_until)}`,
                  `was valid until ${f.date(quote.valid_until)}`,
                ),
              ),
            )}
          </div>
        </article>
      ) : null}

      <div className="two-columns">
        <article className="panel">
          <h2>{t("Čekají na odpověď", "Waiting for an answer")}</h2>
          {waiting.length === 0 ? (
            <p className="muted">
              {t("Žádná odeslaná nabídka nečeká.", "No quote that went out is waiting.")}
            </p>
          ) : (
            <div className="list">{waiting.map((quote) => row(quote, validUntil(quote)))}</div>
          )}
        </article>
        <article className="panel">
          <h2>{t("Rozpracované koncepty", "Drafts in progress")}</h2>
          {drafts.length === 0 ? (
            <p className="muted">{t("Žádný koncept.", "No draft.")}</p>
          ) : (
            <div className="list">
              {drafts.map((quote) =>
                row(
                  quote,
                  t(`upraveno ${f.date(quote.updated_at)}`, `edited ${f.date(quote.updated_at)}`),
                ),
              )}
            </div>
          )}
        </article>
      </div>

      <article className="panel">
        <h2>{t("Ceník", "Price list")}</h2>
        <p>
          {t.count(active.length, ITEMS)}
          {t(", kategorie: ", ", categories: ")}
          {data.categories.length}.{" "}
          {expiring.length > 0
            ? t(
                `Cena, která do měsíce končí nebo už skončila: ${t.count(expiring.length, ITEMS)}.`,
                `A price that ends within a month or has ended: ${t.count(expiring.length, ITEMS)}.`,
              )
            : t("Žádná cena v příštím měsíci nekončí.", "No price ends in the next month.")}{" "}
          <a href={href({ page: "items", category: null })}>
            {t("Otevřít ceník", "Open the price list")}
          </a>{" "}
          ·{" "}
          <a href={href({ page: "import" })}>
            {t("Načíst ceník dodavatele", "Import a supplier's price list")}
          </a>
        </p>
      </article>
    </section>
  );
}
