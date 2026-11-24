import { appAccess } from "@lazurio/module-kit";
import { dataWriter, deployment } from "@lazurio/module-kit/tools";

/** The App's one listener (`lazurio.runtime.listeners[0].id`). */
export const LISTENER = "app";

export type Env = Record<string, string | undefined>;

/** What a request may do in Quotes. */
export interface RequestAccess {
  /** Lazurio stated an application role (or a local entry, an Application Admin). */
  admitted: boolean;
  /** The request may change data now, by the one writer rule. */
  mayWrite: boolean;
  /** The person's subject, recorded with every change; null without one (a local entry). */
  subject: string | null;
}

/**
 * Who came, read from Lazurio for every request and never cached (decision
 * 0231): `appAccess` of `@lazurio/module-kit` is the only source, and no
 * application role grants nothing. Quotes gives an Application User
 * and an Application Admin the same rights; an Organization that wants finer
 * roles adds them in its own copy. Whether the request may write follows the
 * copy (`copyWrites`) and then the module kit's `dataWriter` (Module Standard,
 * Applications of an Organization); the case without
 * `LAZURIO_RUNTIME_DATA_WRITER` is the standard's open point, and the App
 * follows the module kit there. Since module-kit 0.4.1 `dataWriter` itself
 * never writes in a runtime stating production without the variable
 * (Lazurio/module-kit#9); `copyWrites` states the same rule in the App and
 * comes first.
 */
export function accessOf(request: Request, env: Env = process.env): RequestAccess {
  const access = appAccess(request, LISTENER, env);
  return {
    admitted: access.appRole !== null,
    mayWrite: copyWrites(env) && dataWriter(access, env),
    subject: access.person?.subject ?? null,
  };
}

/**
 * Whether this copy of the App may write at all: with
 * `LAZURIO_RUNTIME_DATA_WRITER` only `true` writes; without it, a runtime that
 * states `LAZURIO_RUNTIME_DEPLOYMENT=production` never writes. A copy that may
 * not write changes nothing and never fetches, pulls or publishes.
 */
export function copyWrites(env: Env = process.env): boolean {
  const writer = env.LAZURIO_RUNTIME_DATA_WRITER;
  return writer === undefined ? deployment(env) !== "production" : writer === "true";
}
