import { resolve } from "node:path";
import { deployment } from "@lazurio/module-kit/tools";
import dataRepository from "../../config/data-repository.json";
import { createRepositoryDbStore } from "../data/repository-db-store.ts";
import { serve } from "./serve.ts";

/**
 * A copy that may not write keeps no sync of its own: on an Application host
 * with `LAZURIO_RUNTIME_DATA_WRITER` other than `true`, and in a runtime that
 * states production without it, it neither pulls nor publishes; the host
 * keeps its read-only replica (Module Standard, Applications of an
 * Organization).
 */
const writer = process.env.LAZURIO_RUNTIME_DATA_WRITER;
const syncs = writer === undefined ? deployment() !== "production" : writer === "true";

/** The Module root (`app/v3/src/server` → four levels up); its `db/` is the data checkout. */
const moduleRoot = resolve(import.meta.dir, "..", "..", "..", "..");

await serve(
  () =>
    createRepositoryDbStore({
      mountRoot: resolve(moduleRoot, "db"),
      expect: { ...dataRepository, within: moduleRoot },
      ...(syncs ? {} : { intervalMs: 0 }),
    }),
  "v3",
);
