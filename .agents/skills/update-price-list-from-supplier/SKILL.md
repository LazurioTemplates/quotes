---
name: update-price-list-from-supplier
description: "Use when a person hands over a supplier's price list (a CSV or an Excel export; „aktualizuj ceník z ceníku dodavatele“, „nahraj nový ceník od dodavatele“, „update the price list from the supplier's“): preview every change against the price list with `bun run quotes import:preview`, show it to the person, and only after their word write the chosen rows as a draft with `import:apply`. It never publishes."
---

# Update the price list from a supplier's price list

The supplier sent new prices; the person wants the price list to follow them.
Your job is a preview the person understands and, on their word, a draft with
exactly the rows they chose. Work in `app/v3` of the Module and pass `--lang
cs` or `--lang en` (your Folder's language). Read the Organization's section of
`AGENTS.md` first: it may name its markup and rounding.

## Steps

1. **Get a CSV.** An Excel file is exported as CSV by the person or a tool of
   the Environment; never retype prices. Older Czech exports are
   Windows-1250 (`--encoding windows-1250`); when the preview shows broken
   letters, try the other encoding. Keep the file in `~/Documents/<task>/`.
2. **The supplier's name** as the price list knows it: `bun run quotes items
   --search "<supplier>"` shows it on their items. Use exactly that name;
   another spelling makes every row a new item.
3. **The pricing rule.** Ask the person, unless `AGENTS.md` says it: a markup
   on the purchase price (`--markup <percent>`, with `--round-crowns` for whole
   crowns), or the sale price from the file's column, or the current sale
   prices kept. Ask from which day the new prices apply (`--valid-from`).
4. **Preview:** `bun run quotes import:preview --csv <file> --supplier "<name>"
   [--markup …] [--round-crowns] --valid-from <date> --lang <cs|en>`. Summarize
   for the person: how many new, changed, unchanged and invalid rows; the
   biggest changes of the purchase price in percent; rows with a problem and
   why; the supplier's items the file lacks. Point out what deserves their eye:
   a jump above ten percent, a new sale price below the purchase price, a VAT
   rate the settings do not know.
5. **Ask which rows to take** (all new and changed by default), with your
   harness's question tool.
6. **Write them:** `bun run quotes import:apply` with the same file and
   options, `--token <the token import:preview printed>` and `--rows <the
   chosen rows>`. They become a draft, exactly as the preview showed them. When
   the import is refused as stale, something changed since the preview (the
   price list, the settings or your options): preview again and show the
   person the new preview before you write anything.
7. **The quotes it touches.** `bun run quotes quotes --status draft`, then
   `quote:check` each: a line whose price changed in the price list shows as a
   warning. Tell the person which drafts quote old prices; never reprice a
   quote on your own.
8. **Tell the person** what is in the draft and that they publish it in
   "Koncept a publikování" / "Draft & publish". Items the file lacks stay as
   they are; retiring them is their decision.

## Never

- publish the draft;
- change a sale price beyond the rule the person agreed;
- retire, rename or delete items the file lacks without the person's word.
