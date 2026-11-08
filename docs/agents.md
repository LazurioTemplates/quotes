# Quotes for agents

Agents reach the data of Quotes two ways, both over the same service and the
same rules as the App, and neither publishes or sends anything:

- **`bun run quotes`**, the command line in `app/v3`, which the skills in
  `.agents/skills/` use. It reads and writes the Module's data checkout `db/`
  through the storage port; every write is a draft.
- **WebMCP tools** the App registers in the Environment browser
  (`agent-browser webmcp list`, `webmcp invoke`), for an agent that already
  works in the open App.

## The command line

Run it in `app/v3` of the Module. `--lang cs|en` sets the language of the
output, the checks and the e-mail (use your Folder's language; without it the
language of the Module's settings); `--json`
prints machine-readable output; `--demo` works on the fictional example in
memory, for trying a step without touching `db/`.

| Command | Does |
| --- | --- |
| `items [--search <words>] [--category <id>]` | the price list, or the items whose code, name, description or supplier holds every word |
| `customers [--search <text>]` | the customers |
| `quotes [--status <state>]` | the latest version of every quote |
| `quote:new --input <file.json>` | a new draft quote, see below |
| `quote:show <number\|id>` | a quote with its lines, totals and margin |
| `quote:check <number\|id>` | the check before sending; exit code 1 on an error |
| `quote:email <number\|id>` | recipient, subject, text and the PDF's file name |
| `quote:print <number\|id>` | the path of the print page; the App's `runtime.url` plus this path opens it |
| `quote:act <number\|id> send\|accept\|reject\|expire` | the next state, saved as a draft (`send` refuses a quote with errors) |
| `import:preview --csv <file> --supplier <name> …` | what a supplier's price list would change |
| `import:apply` with the same options, `--token <token>` and `[--rows 2,3,7]` | writes the chosen rows (all new and changed by default) as a draft, exactly as the preview with that token showed them |
| `check` | the rules across the whole data checkout |

Options of the import: `--valid-from YYYY-MM-DD` (default today), `--markup
<percent>` and `--round-crowns` (sale price = purchase price + markup),
`--category <id>` (for new items), `--encoding windows-1250` (older Excel
exports).

`import:preview` ends with the preview's token. `import:apply` needs it and
the same file and options: the token binds the reviewed CSV, its column
mapping, the options, every row the preview showed and the revisions of the
settings, the categories and the items it was computed from. When any of it
changed since, the import is refused as stale (`preview_stale`) and nothing is
written; preview again and show the person the new preview. The rows of
`--rows` must be rows the preview offered to save (new or changed).

### The input of `quote:new`

```json
{
  "customer": "C-0003",
  "title": "Vybavení kanceláře skladu",
  "lines": [
    { "code": "NAB-STUL-160", "quantity": 2 },
    { "code": "NAB-ZIDLE-ERGO", "quantity": 4, "discount_percent": 5 },
    { "name": "Sedací vak do odpočinkové zóny", "quantity": 2 },
    { "name": "Vynášení do 3. patra", "quantity": 1, "unit": "paušál", "unit_price": "800" }
  ],
  "internal_note": "Poptávka e-mailem 5. 11.: …",
  "prepared_by": "Jordan Blake"
}
```

- `customer` is an existing id, or a new contact
  (`{ "name": "…", "email": "…", "company_id": "…" }` with only what the
  inquiry states); a new contact is saved as a draft too.
- A line with `code` takes the name, unit, sale and purchase price and VAT rate
  from the price list; an unknown code refuses the whole input.
- A line without `code` is outside the price list. Without `unit_price` (an
  amount as text, `"1 290,50"` in Czech or `"1,290.50"` in English) it is saved
  at zero with `to_check`, and the check stops the quote until a person fills
  in the price. `vat_rate` names a rate id of the settings (the default rate
  otherwise).
- Optional: `discount_percent` (on the whole quote), `introduction`, `terms`
  (the settings' defaults otherwise), `internal_note`, `prepared_by`.

The new quote gets the next number of the settings' format, today's date and
the usual validity.

## WebMCP tools

| Tool | Input | Returns |
| --- | --- | --- |
| `find_items` | `search` | items of the price list |
| `find_customers` | `search` | customers |
| `find_quotes` | `status` | the latest version of every quote |
| `open_quote` | `id` | one version with its lines |
| `create_quote_draft` | `customer_id`, `title` | the new draft and its id |
| `check_quote` | `id` | the errors and warnings of the check |
| `prepare_quote_email` | `id` | recipient, subject, text, the PDF's name and the print page's path |
| `preview_price_list_import` | `csv`, `supplier`, `valid_from`, `markup_percent`, `round_to_crowns` | the preview and its token; saves nothing |

The descriptions are in the language of the open App. A refusal is an answer
`{ "refused": "<code>", "reason": "…" }`, never a page error.

## The PDF

The print page `/print/quotes/<id>?lang=cs|en` is a whole HTML document. In the
Environment browser (`lazurio browser window`) open the App's `runtime.url`
with that path and save it with `agent-browser --cdp 9222 --session <session>
pdf <path>`, using the file name `quote:email` names. Keep the PDF outside the
repositories, in `~/Documents/<task>/`. `agent-browser pdf` prints on the
browser's default paper (US Letter); a person who prints from the page's
button gets A4, which the page asks for. Both fit the layout; check the PDF
before it goes anywhere.
