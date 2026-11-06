import { seedDirectory } from "../cli/paths.ts";
import { readDataDirectory } from "../data/directory.ts";
import { createMemoryStore } from "../data/memory-store.ts";
import { parseLocale } from "../i18n/locale.ts";
import { serve } from "./serve.ts";

/**
 * `bun run dev:demo [cs|en]`: the App over the fictional example data in
 * that language, held in memory. Nothing is read from or written to a data
 * repository, and every change is gone when the process ends. For trying the
 * template and for the Marketplace screenshots (open the App with `?lang=en`
 * for the English interface); never the start of a real Module.
 */
const locale = parseLocale(process.argv[2]) ?? "cs";
const sample = readDataDirectory(seedDirectory(locale, "sample"));
if (sample.issues.length > 0) {
  console.error(`seed/${locale}/sample is not valid; run \`bun run validate:data\`.`);
  process.exit(1);
}

await serve(() => createMemoryStore(sample.data), `demo (${locale} example data in memory)`);
