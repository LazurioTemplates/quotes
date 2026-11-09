/** JSON with the keys of every object sorted, so equal values give equal text. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item as Record<string, unknown>).sort(([left], [right]) =>
            left < right ? -1 : left > right ? 1 : 0,
          ),
        )
      : item,
  );
}

/**
 * True when two import requests ask for the same thing: the same CSV and the
 * same options. The column mapping is left out: changing it runs a new
 * preview at once.
 */
export function sameImportRequest(
  left: { csv: string; options: unknown },
  right: { csv: string; options: unknown },
): boolean {
  return left.csv === right.csv && canonicalJson(left.options) === canonicalJson(right.options);
}
