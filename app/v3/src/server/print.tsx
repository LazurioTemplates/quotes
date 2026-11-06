import { renderToStaticMarkup } from "react-dom/server";
import type { QuotesStore } from "../data/store.ts";
import { documentCss } from "../document/document-css.ts";
import { QuoteDocument } from "../document/QuoteDocument.tsx";
import { designSystemStylesheet } from "../document/theme.ts";
import { pdfFileName } from "../domain/email.ts";
import { DEFAULT_LOCALE, type Locale, parseLocale, pick } from "../i18n/locale.ts";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

/**
 * The print page of one quote version, `/print/quotes/<id>?lang=cs|en`: a
 * whole HTML document rendered on the server, so a browser prints it to PDF
 * as it is (Ctrl+P, or an agent's `agent-browser pdf`). The App links it in
 * the person's language; without `lang` it is Czech. The toolbar is hidden on
 * paper.
 */
export function createPrintHandler(store: QuotesStore) {
  return async function print(pathname: string, lang?: string | null): Promise<Response | null> {
    const locale: Locale = parseLocale(lang) ?? DEFAULT_LOCALE;
    const t = (cs: string, en: string) => pick(locale, cs, en);
    const match = /^\/print\/quotes\/([^/]+)$/.exec(pathname);
    if (!match?.[1]) return null;
    let id: string;
    try {
      id = decodeURIComponent(match[1]);
    } catch {
      return new Response("Bad request", { status: 400 });
    }
    const [found, settings] = await Promise.all([store.getQuote(id), store.settings()]);
    if (!found) {
      return new Response(t(`Nabídka ${id} neexistuje.`, `The quote ${id} does not exist.`), {
        status: 404,
      });
    }
    const quote = found.value;
    const title = pdfFileName(quote, locale).replace(/\.pdf$/, "");
    const body = renderToStaticMarkup(
      <QuoteDocument quote={quote} settings={settings.value} locale={locale} />,
    );
    const html = `<!doctype html>
<html lang="${locale}" data-theme="light">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${designSystemStylesheet()}${documentCss}</style>
</head>
<body>
<nav class="toolbar" aria-label="${t("Tisk", "Print")}">
<a href="/#/quotes/${encodeURIComponent(id)}">${t("← Zpět na nabídku", "← Back to the quote")}</a>
<span class="hint">${t("V dialogu tisku zvolte „Uložit jako PDF“.", "In the print dialog choose “Save as PDF”.")}</span>
<button type="button" onclick="window.print()">${t("Vytisknout nebo uložit PDF", "Print or save as PDF")}</button>
</nav>
${body}
</body>
</html>`;
    return new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  };
}
