import { SAMPLE_DATA } from "../cli/paths.ts";
import { readDataDirectory } from "../data/directory.ts";
import { createMemoryStore } from "../data/memory-store.ts";
import { serve } from "./serve.ts";

/**
 * `bun run dev:demo`: the App over the fictional example data, held in
 * memory. Nothing is read from or written to a data repository, and every
 * change is gone when the process ends. For trying the template and for the
 * Marketplace screenshots; never the start of a real Module.
 */
const sample = readDataDirectory(SAMPLE_DATA);
if (sample.issues.length > 0) {
  console.error("seed/sample is not valid; run `bun run validate:data`.");
  process.exit(1);
}

await serve(() => createMemoryStore(sample.data), "demo (example data in memory)");
