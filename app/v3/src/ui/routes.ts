import { QUOTE_STATUSES, type QuoteStatus } from "../domain/quote.ts";

/** The App's pages, addressed by the URL hash so a reload keeps the page. */
export type Route =
  | { page: "overview" }
  | { page: "quotes"; status: QuoteStatus | null }
  | { page: "new-quote" }
  | { page: "quote"; id: string }
  | { page: "edit-quote"; id: string }
  | { page: "items"; category: string | null }
  | { page: "new-item" }
  | { page: "item"; code: string }
  | { page: "import" }
  | { page: "customers" }
  | { page: "new-customer" }
  | { page: "customer"; id: string }
  | { page: "settings" }
  | { page: "draft" }
  | { page: "not-found" };

export function parseRoute(hash: string): Route {
  const [path = "", query = ""] = hash.replace(/^#/, "").split("?");
  let parts: string[];
  try {
    parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    return { page: "not-found" };
  }
  const params = new URLSearchParams(query);
  const [first, second, third] = parts;
  if (parts.length === 0) return { page: "overview" };
  if (first === "quotes") {
    if (parts.length === 1) {
      const status = params.get("status");
      return {
        page: "quotes",
        status: QUOTE_STATUSES.includes(status as QuoteStatus) ? (status as QuoteStatus) : null,
      };
    }
    if (second === "new" && parts.length === 2) return { page: "new-quote" };
    if (second && parts.length === 2) return { page: "quote", id: second };
    if (second && third === "edit" && parts.length === 3) return { page: "edit-quote", id: second };
  }
  if (first === "items" && parts.length === 1) {
    return { page: "items", category: params.get("category") || null };
  }
  if (first === "items" && second && parts.length === 2) return { page: "item", code: second };
  if (first === "new-item" && parts.length === 1) return { page: "new-item" };
  if (first === "import" && parts.length === 1) return { page: "import" };
  if (first === "customers" && parts.length === 1) return { page: "customers" };
  if (first === "customers" && second === "new" && parts.length === 2) {
    return { page: "new-customer" };
  }
  if (first === "customers" && second && parts.length === 2)
    return { page: "customer", id: second };
  if (first === "settings" && parts.length === 1) return { page: "settings" };
  if (first === "draft" && parts.length === 1) return { page: "draft" };
  return { page: "not-found" };
}

export function href(route: Route): string {
  switch (route.page) {
    case "overview":
      return "#/";
    case "quotes":
      return route.status ? `#/quotes?status=${route.status}` : "#/quotes";
    case "new-quote":
      return "#/quotes/new";
    case "quote":
      return `#/quotes/${encodeURIComponent(route.id)}`;
    case "edit-quote":
      return `#/quotes/${encodeURIComponent(route.id)}/edit`;
    case "items":
      return route.category ? `#/items?category=${encodeURIComponent(route.category)}` : "#/items";
    case "new-item":
      return "#/new-item";
    case "item":
      return `#/items/${encodeURIComponent(route.code)}`;
    case "import":
      return "#/import";
    case "customers":
      return "#/customers";
    case "new-customer":
      return "#/customers/new";
    case "customer":
      return `#/customers/${encodeURIComponent(route.id)}`;
    case "settings":
      return "#/settings";
    case "draft":
      return "#/draft";
    case "not-found":
      return "#/";
  }
}

export function navigate(route: Route): void {
  window.location.hash = href(route);
}
