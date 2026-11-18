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

/** The pause before the next ask after `failures` failed ones: 1 s, 2 s, 4 s … at most 30 s. */
export function statusRetryDelay(failures: number): number {
  return Math.min(30_000, 1_000 * 2 ** Math.max(0, failures - 1));
}

/**
 * Asks the server whether this copy writes for the visitor until it answers,
 * with a growing pause after each failure, so a passing failure does not
 * leave the page without its actions and its tools for good. Returns the
 * function that stops asking.
 */
export function followWriteStatus(
  read: () => Promise<{ mayWrite?: boolean }>,
  onKnown: (canWrite: boolean) => void,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((done) => setTimeout(done, ms)),
): () => void {
  let stopped = false;
  void (async () => {
    for (let failures = 0; !stopped; failures += 1) {
      if (failures > 0) await wait(statusRetryDelay(failures));
      if (stopped) return;
      try {
        const status = await read();
        if (!stopped) onKnown(status.mayWrite === true);
        return;
      } catch {
        // Asked again after the pause.
      }
    }
  })();
  return () => {
    stopped = true;
  };
}
