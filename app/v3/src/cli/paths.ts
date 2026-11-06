import { resolve } from "node:path";

/** The App package: `app/v3/src/cli` → two levels up. */
export const APP_ROOT = resolve(import.meta.dir, "..", "..");
/** The Module root: four levels up. */
export const MODULE_ROOT = resolve(APP_ROOT, "..", "..");
/** The data repository skeleton an adopting Organization starts from. */
export const DATA_REPO_TEMPLATE = resolve(MODULE_ROOT, "templates", "data-repo");
/** The records of the empty start: settings with placeholders and two categories. */
export const EMPTY_DATA = resolve(APP_ROOT, "seed", "empty");
/** Fictional example records for the "example data" start. */
export const SAMPLE_DATA = resolve(APP_ROOT, "seed", "sample");
/** The Module's data checkout. */
export const DATA_MOUNT = resolve(MODULE_ROOT, "db");
