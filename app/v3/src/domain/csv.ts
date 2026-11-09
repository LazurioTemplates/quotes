/**
 * A small CSV reader for suppliers' price lists (RFC 4180 with the habits of
 * Czech exports): the delimiter is `;`, `,` or a tab, whichever the header
 * uses most; fields may be quoted with `"` and contain the delimiter, quotes
 * (`""`) and line breaks; a byte order mark and empty lines are skipped.
 */
export const DELIMITERS = [";", ",", "\t"] as const;
export type Delimiter = (typeof DELIMITERS)[number];

export function detectDelimiter(text: string): Delimiter {
  const header = stripBom(text).split(/\r?\n/, 1)[0] ?? "";
  let best: Delimiter = ";";
  let bestCount = 0;
  for (const delimiter of DELIMITERS) {
    let count = 0;
    let quoted = false;
    for (const character of header) {
      if (character === '"') quoted = !quoted;
      else if (!quoted && character === delimiter) count += 1;
    }
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function parseCsv(input: string, delimiter: Delimiter = detectDelimiter(input)): string[][] {
  const text = stripBom(input);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let index = 0;
  const endRow = () => {
    row.push(field);
    field = "";
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
    row = [];
  };
  while (index < text.length) {
    const character = text[index] as string;
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else quoted = false;
      } else field += character;
    } else if (character === '"' && field.trim() === "") {
      field = "";
      quoted = true;
    } else if (character === delimiter) {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      endRow();
    } else field += character;
    index += 1;
  }
  if (field !== "" || row.length > 0) endRow();
  return rows.map((cells) => cells.map((cell) => cell.trim()));
}
