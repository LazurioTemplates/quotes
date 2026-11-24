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

/** The browser's WebMCP API, or `null` where it offers none. */
function browserModelContext(): ModelContextLike | null {
  const scope = globalThis as {
    document?: { modelContext?: ModelContextLike };
    navigator?: { modelContext?: ModelContextLike };
  };
  return scope.document?.modelContext ?? scope.navigator?.modelContext ?? null;
}

/**
 * The model context the page hands to `registerAgentTools`. In a browser
 * with WebMCP, `registerTool(tool, { signal })` returns a promise that
 * rejects with an `AbortError` once the signal aborts, which is exactly how
 * the kit removes a tool; module-kit 0.6.0 leaves that promise unhandled
 * (Lazurio/module-kit#14). The wrapper handles it and returns the browser's
 * own answer unchanged, so a legacy `unregister()` handle keeps working.
 */
export function quietModelContext(context: ModelContextLike | null): ModelContextLike | null {
  if (context === null) return null;
  return {
    registerTool: (tool, options) => {
      const handle = context.registerTool(tool, options);
      const thenable = handle as { then?: unknown } | null | undefined;
      if (typeof thenable?.then === "function")
        (handle as PromiseLike<unknown>).then(undefined, () => {});
      return handle;
    },
  };
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
  const context = quietModelContext(
    options.modelContext === undefined ? browserModelContext() : options.modelContext,
  );
  const ready = registerAgentTools({
    viewTools: options.views ?? VIEW_TOOLS,
    fetch: fetchIn(locale, options.fetch),
    modelContext: context,
  }).then(
    (registered) => {
      if (!stopped) tools = registered;
      else
        try {
          registered.unregister();
        } catch {
          // The browser refused the removal; the page goes on.
        }
    },
    // A browser that refuses a registration leaves the page without tools,
    // never without its interface.
    () => {},
  );
  // One refresh at a time: two at once would register the same names twice,
  // which the browser refuses.
  let queue: Promise<unknown> = ready;
  return {
    // Neither call ever rejects: a failed removal or refresh leaves the page
    // with fewer tools, never with an unhandled rejection.
    remove: () => {
      stopped = true;
      const unregister = () => {
        try {
          tools?.unregister();
        } catch {
          // The browser refused the removal; the page goes on.
        }
      };
      unregister();
      // A refresh already waiting for `/api/agent-tools` registers its tools
      // after this call; once it settles, those go too.
      queue = queue.then(unregister, unregister);
    },
    refresh: () => {
      queue = queue.then(() => (stopped ? undefined : tools?.refresh())).catch(() => undefined);
    },
  };
}
