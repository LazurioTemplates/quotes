// The validation of this Module's data, part of `bun run check`: every
// document of the directories given is a record of a collection of
// src/domain/collections.ts, matches its schema and is stored under its id,
// and the records keep the rules across records (src/domain/rules.ts).
//
//   bun run validate:data   the records this repository carries (seed/empty, seed/sample)
//   bun run validate:db     the records of db/ before a publication; db/ is a
//                           repository of its own that CI does not check out
//
// A directory is laid out like db/data/: one subdirectory per collection, one
// document <id>.yaml each, with the envelope of repository-db
// (schemaVersion, id, record). Every other entry is a problem; only the empty
// placeholder `.gitkeep` that keeps an empty directory in Git is left out.
import { readDataDirectory } from "./data/directory.ts";

if (import.meta.main) {
  const roots = process.argv.slice(2);
  if (roots.length === 0) {
    console.error("Usage: bun run src/validate-data.ts <data directory>...");
    process.exit(2);
  }
  let problems = 0;
  let documents = 0;
  for (const root of roots) {
    const result = readDataDirectory(root);
    documents += result.documents;
    for (const issue of result.issues) console.error(`${root}: ${issue.record}: ${issue.message}`);
    problems += result.issues.length;
  }
  if (problems > 0) process.exit(1);
  console.log(`Data valid: ${documents} document(s) in ${roots.join(", ")}.`);
}
