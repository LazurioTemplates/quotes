// The search of a table page: which rows a query shows. Case and surrounding
// spaces don't matter; an empty query shows every row.
export function rowsMatching(rows: readonly string[], query: string): boolean[] {
  const needle = query.trim().toLowerCase();
  return rows.map((row) => row.toLowerCase().includes(needle));
}
