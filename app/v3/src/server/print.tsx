import { renderToStaticMarkup } from "react-dom/server";
import type { QuotesStore } from "../data/store.ts";
import { documentCss } from "../document/document-css.ts";
import { QuoteDocument } from "../document/QuoteDocument.tsx";
import { tokenStylesheet } from "../document/tokens.ts";
import { pdfFileName } from "../domain/email.ts";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

/**
 * The print page of one quote version, `/print/quotes/<id>`: a whole HTML
 * document rendered on the server, so a browser prints it to PDF as it is
 * (Ctrl+P, or an agent's `agent-browser pdf`). The toolbar is hidden on paper.
 */
export function createPrintHandler(store: QuotesStore) {
  return async function print(pathname: string): Promise<Response | null> {
    const match = /^\/print\/quotes\/([^/]+)$/.exec(pathname);
    if (!match?.[1]) return null;
    let id: string;
    try {
      id = decodeURIComponent(match[1]);
    } catch {
      return new Response("Bad request", { status: 400 });
    }
    const [found, settings] = await Promise.all([store.getQuote(id), store.settings()]);
    if (!found) return new Response(`Nabídka ${id} neexistuje.`, { status: 404 });
    const quote = found.value;
    const title = `${pdfFileName(quote).replace(/\.pdf$/, "")}`;
    const body = renderToStaticMarkup(<QuoteDocument quote={quote} settings={settings.value} />);
    const html = `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${tokenStylesheet()}${documentCss}</style>
</head>
<body>
<nav class="toolbar" aria-label="Tisk">
<a href="/#/quotes/${encodeURIComponent(id)}">← Zpět na nabídku</a>
<span class="hint">V dialogu tisku zvolte „Uložit jako PDF“.</span>
<button type="button" onclick="window.print()">Vytisknout nebo uložit PDF</button>
</nav>
${body}
</body>
</html>`;
    return new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  };
}
