import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Where a change came from (Module Standard, One data port: author and
 * channel): the interface, `/mcp`, the page's tools, an import, or the
 * command line agents use (`cli`, beyond the Standard's four).
 */
export type Channel = "ui" | "mcp" | "webmcp" | "import" | "cli";

export interface Origin {
  /** The person's `subject`; null for a caller without one (a local entry, the CLI), never invented. */
  subject: string | null;
  channel: Channel;
}

const ORIGIN = new AsyncLocalStorage<Origin>();

/** Runs `operation` with `origin` as the origin of every change it makes. */
export function withOrigin<T>(origin: Origin, operation: () => T): T {
  return ORIGIN.run(origin, operation);
}

/** The origin of the change being made; null where nobody stated one. */
export function currentOrigin(): Origin | null {
  return ORIGIN.getStore() ?? null;
}

/** A draft's origin kind for repository-db: an agent's channel or the App's. */
export function originKind(channel: Channel): "app" | "agent" {
  return channel === "mcp" || channel === "webmcp" || channel === "cli" ? "agent" : "app";
}
