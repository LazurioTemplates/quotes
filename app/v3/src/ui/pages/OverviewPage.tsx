import { calculateQuote } from "../../domain/calculate.ts";
import { formatDate, localToday } from "../../domain/common.ts";
import { formatMoney } from "../../domain/money.ts";
import { idOfQuote, isPastValidity, latestVersions, type Quote } from "../../domain/quote.ts";
import type { AppData } from "../App.tsx";
import { PageHeader, StatusChip } from "../components/common.tsx";
import { href } from "../routes.ts";

export function OverviewPage({ data, today = localToday() }: { data: AppData; today?: string }) {
  const settings = data.settings.value;
  const latest = latestVersions(data.quotes.map((entry) => entry.value));
  const payable = (quote: Quote) => calculateQuote(quote, settings).payable;
  const money = (amount: number) => formatMoney(amount, settings.currency);
  const drafts = latest.filter((quote) => quote.status === "draft");
  const waiting = latest.filter((quote) => quote.status === "sent" && !isPastValidity(quote, today));
  const overdue = latest.filter((quote) => isPastValidity(quote, today));
  const accepted = latest.filter((quote) => quote.status === "accepted");
  const sum = (quotes: readonly Quote[]) => quotes.reduce((total, quote) => total + payable(quote), 0);
  const expiring = data.items.filter(
    (entry) => !entry.value.archived && entry.value.valid_to !== undefined && entry.value.valid_to <= addMonth(today),
  );

  const row = (quote: Quote, note?: string) => (
    <a key={idOfQuote(quote)} className="list-row" href={href({ page: "quote", id: idOfQuote(quote) })}>
      <span className="code-link">{quote.number}</span>
      <span className="list-row-title">
        {quote.title}
        <span className="muted"> · {quote.customer.name}</span>
      </span>
      <StatusChip status={quote.status} />
      <span className="num">{money(payable(quote))}</span>
      <span className="muted list-row-note">{note ?? `platí do ${formatDate(quote.valid_until)}`}</span>
    </a>
  );

  return (
    <section>
      <PageHeader
        eyebrow={settings.supplier.name}
        title="Přehled nabídek"
        subtitle="Co čeká na odpověď zákazníka, co je rozpracované a co je potřeba uzavřít."
        actions={
          <a className="button button-primary" href={href({ page: "new-quote" })}>
            Nová nabídka
          </a>
        }
      />
      <div className="stats">
        <a className="stat" href={href({ page: "quotes", status: "draft" })}>
          <span className="stat-value">{drafts.length}</span>
          <span className="stat-label">Rozpracované koncepty</span>
        </a>
        <a className="stat" href={href({ page: "quotes", status: "sent" })}>
          <span className="stat-value">{waiting.length}</span>
          <span className="stat-label">Čekají na odpověď</span>
        </a>
        <div className="stat">
          <span className="stat-value">{money(sum(waiting))}</span>
          <span className="stat-label">Hodnota odeslaných nabídek s DPH</span>
        </div>
        <a className="stat" href={href({ page: "quotes", status: "accepted" })}>
          <span className="stat-value">{accepted.length}</span>
          <span className="stat-label">Přijaté nabídky</span>
        </a>
      </div>

      {overdue.length > 0 ? (
        <article className="panel panel-warning">
          <h2>Po platnosti</h2>
          <p className="muted">
            Zákazník se do konce platnosti neozval. Otevřete nabídku a označte ji jako propadlou,
            nebo z ní vytvořte novou verzi.
          </p>
          <div className="list">{overdue.map((quote) => row(quote, `platila do ${formatDate(quote.valid_until)}`))}</div>
        </article>
      ) : null}

      <div className="two-columns">
        <article className="panel">
          <h2>Čekají na odpověď</h2>
          {waiting.length === 0 ? (
            <p className="muted">Žádná odeslaná nabídka nečeká.</p>
          ) : (
            <div className="list">{waiting.map((quote) => row(quote))}</div>
          )}
        </article>
        <article className="panel">
          <h2>Rozpracované koncepty</h2>
          {drafts.length === 0 ? (
            <p className="muted">Žádný koncept.</p>
          ) : (
            <div className="list">{drafts.map((quote) => row(quote, `upraveno ${formatDate(quote.updated_at)}`))}</div>
          )}
        </article>
      </div>

      <article className="panel">
        <h2>Ceník</h2>
        <p>
          {data.items.filter((entry) => !entry.value.archived).length} položek v{" "}
          {data.categories.length} kategoriích.{" "}
          {expiring.length > 0
            ? `${expiring.length} z nich má cenu, která do měsíce končí nebo už skončila.`
            : "Žádná cena v příštím měsíci nekončí."}{" "}
          <a href={href({ page: "items", category: null })}>Otevřít ceník</a> ·{" "}
          <a href={href({ page: "import" })}>Načíst ceník dodavatele</a>
        </p>
      </article>
    </section>
  );
}

function addMonth(date: string): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}
