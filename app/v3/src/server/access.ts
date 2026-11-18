import { appAccess } from "@lazurio/module-kit";
import { dataWriter } from "@lazurio/module-kit/tools";

/** The App's one listener (`lazurio.runtime.listeners[0].id`). */
export const LISTENER = "app";

export type Env = Record<string, string | undefined>;

/** What a request may do in Mission Control. */
export interface RequestAccess {
  /** Lazurio stated an application role (or a local entry, an Application Admin). */
  admitted: boolean;
  /** The request may change data now, by the one writer rule. */
  mayWrite: boolean;
}

/**
 * Who came, read from Lazurio for every request and never cached (decision
 * 0231): `appAccess` of `@lazurio/module-kit` is the only source, and no
 * application role grants nothing. Quotes gives an Application User
 * and an Application Admin the same rights; an Organization that wants finer
 * roles adds them in its own copy. Whether the request may write follows the
 * module kit's `dataWriter` (Module Standard, Applications of an Organization);
 * the case without `LAZURIO_RUNTIME_DATA_WRITER` is the standard's open point,
 * and the App builds nothing of its own on it.
 */
export function accessOf(request: Request, env: Env = process.env): RequestAccess {
  const access = appAccess(request, LISTENER, env);
  return { admitted: access.appRole !== null, mayWrite: dataWriter(access, env) };
}
