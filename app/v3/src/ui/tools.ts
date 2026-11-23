import {
  type AgentTools,
  type ModelContextLike,
  type PageViewTool,
  registerAgentTools,
} from "@lazurio/module-kit/webmcp";
import type { Locale } from "../i18n/locale.ts";

/**
 * The page's side of the tools for agents (Module Standard, "Agents in the
 * App"). The tools are defined once on the server (`server/agent-tools.ts`)
 * and the page registers exactly those its server lists for the person now,
 * already filtered by role and writer mode; each call goes to the same
 * handler as `/mcp`, with the page's own session. The page states its
 * language, so the descriptions and the answers speak the open App's.
 *
 * Quotes has no view tool of its own: every tool of the App reads or writes
 * its data, and none only opens a view.
 */

/** The page's view tools: none (see above); a page that adds one, for
 * example opening a quote's detail, lists it here. */
export const VIEW_TOOLS: readonly PageViewTool[] = [];

/** The page's registration: removes the tools, or asks the server again
 * (after a sign-in or a change of the writer mode). */
export interface InstalledTools {
  readonly remove: () => void;
  readonly refresh: () => void;
}

/** `fetch` that states the page's language to the tools' endpoints. */
export function fetchIn(locale: Locale, base: typeof fetch = fetch): typeof fetch {
  return ((input: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    headers.set("accept-language", locale);
    return base(input, { ...init, headers });
  }) as typeof fetch;
}

/** Registers the server's tools where the browser offers WebMCP; elsewhere
 * nothing is registered and the page works the same. */
export function installTools(
  locale: Locale,
  options: {
    views?: readonly PageViewTool[];
    modelContext?: ModelContextLike | null;
    fetch?: typeof fetch;
  } = {},
): InstalledTools {
  let tools: AgentTools | null = null;
  let stopped = false;
  const ready = registerAgentTools({
    viewTools: options.views ?? VIEW_TOOLS,
    fetch: fetchIn(locale, options.fetch),
    ...(options.modelContext === undefined ? {} : { modelContext: options.modelContext }),
  }).then(
    (registered) => {
      if (stopped) registered.unregister();
      else tools = registered;
    },
    // A browser that refuses a registration leaves the page without tools,
    // never without its interface.
    () => {},
  );
  return {
    remove: () => {
      stopped = true;
      tools?.unregister();
    },
    refresh: () => {
      void ready.then(() => (stopped ? undefined : tools?.refresh().catch(() => [])));
    },
  };
}
