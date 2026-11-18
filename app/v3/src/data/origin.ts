import { AsyncLocalStorage } from "node:async_hooks";

/** Where a change came from (Module Standard, One data port: author and channel). */
export type Channel = "ui" | "mcp" | "webmcp" | "import";

export interface Origin {
  /** The person's `subject`; null for a caller without one (a local entry), never invented. */
  subject: string | null;
  channel: Channel;
}

const ORIGIN = new AsyncLocalStorage<Origin>();

/** Runs `operation` with `origin` as the origin of every change it makes. */
export function withOrigin<T>(origin: Origin, operation: () => T): T {
  return ORIGIN.run(origin, operation);
}

/** The origin of the change being made; outside a request, the interface without a person. */
export function currentOrigin(): Origin {
  return ORIGIN.getStore() ?? { subject: null, channel: "ui" };
}

/** A draft's origin kind for repository-db: an agent's channel or the App's. */
export function originKind(channel: Channel): "app" | "agent" {
  return channel === "mcp" || channel === "webmcp" ? "agent" : "app";
}
