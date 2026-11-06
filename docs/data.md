# The data of Quotes

Quotes keeps its records in the Organization's data repository
`<Organization>/quotes-data`, branch `v3`, checked out as `db/` at the Module
root and read and written only through [repository-db](https://github.com/Lazurio/repository-db).

## Collections

Every record is one YAML document `data/<collection>/<id>.yaml` in the
envelope of repository-db:

```yaml
id: NAB-ZIDLE-ERGO
record:
  category: nabytek
  code: NAB-ZIDLE-ERGO
  name: Ergonomická kancelářská židle
  purchase_price: 430000
  sale_price: 679000
  unit: ks
  valid_from: 2026-07-01
  vat_rate: standard
schemaVersion: quotes.item.v1
```

| Collection | Id | `schemaVersion` | Holds |
| --- | --- | --- | --- |
| `settings` | `settings` | `quotes.settings.v1` | the App's language while Lazurio does not hand it the person's, currency, VAT rates and the default one, the quote number format, validity in days, rounding of the total, the minimum margin, the Organization's details on a quote, default texts, the e-mail template |
| `categories` | a slug | `quotes.category.v1` | name and order |
| `items` | the item's code | `quotes.item.v1` | name, category, unit, purchase and sale price, VAT rate id, valid from and until, supplier and the supplier's code, retired, the price history |
| `customers` | `C-0001` | `quotes.customer.v1` | name, company ID, VAT ID, address, contact person, e-mail, phone, an internal note |
| `quotes` | `<number>-v<version>` | `quotes.quote.v1` | number, version, state, subject, the customer as the quote names them, dates, currency, lines, discount on the whole, texts for the customer, an internal note |

The schemas are Zod in `app/v3/src/domain/` and nothing else; `bun run
schema:export` writes their JSON Schemas into `templates/data-repo/schemas/`.

## Money and numbers

- **Amounts** are whole minor units of the currency, haléře for CZK:
  `139000` is 1 390,00 Kč. Prices are without VAT.
- **Quantities** have at most three decimals (`2.5` hours), **percentages**
  (VAT, discounts) at most two.
- **A line** is `quantity × unit price`, rounded half up to a haléř, minus its
  own discount. **The discount on the whole quote** is split across the lines
  in proportion to their amounts (largest remainder), so it lands in the right
  VAT rate and the parts add up exactly. **VAT** is computed once per rate
  from the sum of that rate's bases and rounded half up to a haléř. With
  `total_rounding: whole` the total is rounded to whole crowns and the
  difference is shown as a line of its own.
- Every product goes through BigInt (`app/v3/src/domain/money.ts`); no amount is
  ever a floating-point crown. `tests/money.test.ts` and
  `tests/calculate.test.ts` hold the cases.

## Rules across records

`app/v3/src/domain/rules.ts`: an item names an existing category and VAT rate;
its price history is in date order; a quote names an existing customer and
existing items, ends its validity after its issue, and version N follows
version N-1. The App checks the rules before every save and `bun run
validate:db` checks the whole checkout; the data repository's validator checks
the shape only.

## Versions of a quote

A draft is edited in place. "Označit jako odeslanou" (mark as sent) locks the
version; an edit after that is "Upravit jako novou verzi", a new record
`<number>-v<N+1>` that starts as a draft. Old versions stay as they were sent.
Accepted, rejected and expired are the states a sent version ends in;
an accepted quote is closed.

## The data repository

`templates/data-repo/` is what an adopting Organization puts into its
`quotes-data` (see [`adoption.md`](adoption.md)):

| Path | Holds |
| --- | --- |
| `repository-db.yaml` | `schema`, `layout` and `validate` for the engine |
| `schemas/*.schema.json` | generated; never edited there |
| `scripts/validate.ts` | the dependency-free validator repository-db runs before every publish |
| `.github/workflows/validate.yml` | the same validator in CI |
| `AGENTS.md`, `README.md` | the rules and the map of the data repository |

The records of a start come from `app/v3/seed/<cs|en>/<empty|sample>/`, laid
out like `data/`. `empty` holds the settings with Czech VAT rates and
placeholders for the Organization's details, and two categories; `sample`
holds the fictional company Example s.r.o. with 13 items, 3 customers and 6
quote versions in every state.
