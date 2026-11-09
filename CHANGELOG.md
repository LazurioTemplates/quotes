# Changelog

## 0.1.0 (proposed)

The first release of Quotes, a template of the Lazurio Marketplace. The App
is generation `app/v3` on the stack profile `app-data@2026.11`; it was born
from the scaffold of `lazurio module create --stack vite-react --data`.

### For people

- **Price list**: items with categories, units, purchase and sale prices
  without VAT, a VAT rate, the dates a price is valid and a price history;
  retired items stay for old quotes.
- **Import of a supplier's price list** from CSV with a preview of every new,
  changed and invalid row and of the supplier's items the file lacks; a
  markup with rounding to whole crowns, or the file's sale price; only the
  chosen rows are written, exactly as the preview showed them (its token binds
  the request, the rows and the revisions of the data, checked again in the
  same atomic write; a stale preview is refused in the App and on the command
  line).
- **Quotes**: customers in the Module's own contacts, lines from the price list
  or outside it, discounts per line and on the whole quote, VAT per rate,
  subtotals, totals and an optional rounding to whole crowns, numbers in a
  format of the Organization's choice, validity, the states draft, sent,
  accepted, rejected and expired, and versions after a quote went out; a
  version that went out keeps the Organization's details, the rounding and the
  e-mail templates it went out with, so its print, totals and e-mail never
  change.
- **The check before sending**: errors that stop a quote (a line waiting for a
  price, an expired validity, placeholder details of the Organization) and
  warnings (a price that changed in the price list, a VAT rate, a sale below
  the purchase price, a low margin, a customer without e-mail).
- **For the customer**: a print page in the look of the design system, saved
  as PDF by the browser, and the e-mail text from the Organization's template.
- **Draft & Publish** on every save, with the changed fields named and amounts
  shown in crowns.
- The interface, the starts and the example in **Czech and English**: the
  person's language from Lazurio's shell document where it arrives, otherwise
  the language of the Module's settings (LazurioPlatform#909).

### For Organizations and agents

- Zod is the only definition of the data; the JSON Schemas of the data
  repository are generated (`bun run schema:export`) and checked.
- The storage port `app/v3/src/data/store.ts` with a repository-db store and a
  memory store, both passing `tests/store-contract.ts`.
- Money in whole haléře, every product through BigInt, rounding half up; VAT
  from the base of each rate.
- Skills `prepare-quote-from-inquiry`, `update-price-list-from-supplier` and
  `check-quote-before-sending`, and `bun run quotes`, the command line they use.
- WebMCP tools for the main actions; none publishes or sends.
- `templates/data-repo/` with a dependency-free validator, and the starts
  `app/v3/seed/<cs|en>/<empty|sample>/`.
- `design-system/`: LazurioTemplates/design-system v1.0.0 merged as a subtree;
  a later release arrives as a merge of its tag.
- One gate, `bun run check`, on Ubuntu and Windows.
