import { createContext, useContext } from "react";

/**
 * Whether this copy lets the person change data now, from `/api/status`
 * (the one writer rule of the Module Standard); `null` until it is known.
 * Until it is known, and on a copy that may not write, the page offers no
 * change: no new quote, item or customer, no editing, no import, no state
 * change of a quote and no publish, pull or revert.
 */
export const WriteContext = createContext<boolean | null>(null);

export function useCanWrite(): boolean {
  return useContext(WriteContext) === true;
}

/** True only once the server said this copy is read-only, for the notice. */
export function useReadOnly(): boolean {
  return useContext(WriteContext) === false;
}
