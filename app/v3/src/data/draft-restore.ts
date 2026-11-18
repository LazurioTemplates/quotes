import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

/**
 * A draft of several records that fails while it is being written takes back
 * what it wrote, as far as it can (Module Standard, One data port: atomic
 * writes). Every check runs before the first record is written, so a write
 * fails midway only when the file system refuses it; `run` then gets every
 * file back to what it held before (or removes a file it created) and
 * rethrows, while the caller still holds the draft write gate.
 *
 * Not a full guarantee: readers do not take the gate, a stop of the process
 * midway cannot be undone here, and a restore can fail like the write. The
 * draft review shows what is left; an atomic write is an engine change
 * (Lazurio/repository-db#45).
 *
 * `run` calls `remember(file)` right before it writes `file`.
 */
export function restoringOnFailure<T>(run: (remember: (file: string) => void) => T): T {
  const before = new Map<string, Buffer | null>();
  const remember = (file: string) => {
    if (!before.has(file)) before.set(file, existsSync(file) ? readFileSync(file) : null);
  };
  try {
    return run(remember);
  } catch (error) {
    for (const [file, bytes] of [...before].reverse()) {
      try {
        if (bytes === null) rmSync(file, { force: true });
        else writeFileSync(file, bytes);
      } catch {
        // The original refusal is what the caller needs; a file that could
        // not be restored shows in the draft review as a change.
      }
    }
    throw error;
  }
}
