# Changelog

## Unreleased

## 0.3.0 — 2026-11-24

### For whoever runs it

- **All writers at once.** With `app-data@2027.03` (`@lazurio/repository-db`
  v3.4.0) every writer of the Module's data stores a new `record.revision` on
  every write: the App, an import, an agent's script, a direct change. Take
  this release in every Environment that writes the same data before their
  writes meet. A writer that keeps or leaves out the revision makes the merge
  fail on `/record/revision`.
- The stack profile release `app-data@2027.03`: `@lazurio/module-kit` v0.6.0
  instead of v0.4.0. A runtime that states production never writes without
  `LAZURIO_RUNTIME_DATA_WRITER=true` (module-kit 0.4.1). module-kit 0.6.0
  offers an App's publication tools (`effect: "publish"`) in a production
  application too, and every audit line carries the tool's `effect`. This
  template offers no publication tool.
  Nothing in an adopted copy's own files changes; take it by merging the tag.
- `@lazurio/repository-db` v3.4.0 instead of v3.2.6. It treats
  `record.revision` as audit metadata with `record.updatedAt`: two changes of
  different fields of one record merge, and a record whose `revision` one side
  kept is refused on `/record/revision`. Records without `revision` behave as
  before.
- Every write of the App stores a new random write revision in
  `record.revision` and the instant in `record.updatedAt`, in every
  collection, also a save of several items and an import. The revision the App
  hands out and checks covers that value and the content (Module Standard,
  "One data port"): after A → B → A it is new, so an editor who opened A
  first and an import preview computed from A are refused instead of
  overwriting, and a direct change of a file that kept the old `revision` is
  seen as a change. Before, the revision was a fingerprint of the content
  alone and repeated after A → B → A. A save that changes nothing writes
  nothing. The values the App shows and its API and tools return leave both
  fields out; the Draft & Publish card does not count them as changed fields.
  The schemas allow both as optional (`revision` a non-empty string,
  `updatedAt` an instant `YYYY-MM-DDTHH:MM:SS.sssZ`), so existing records stay
  valid. Copy the regenerated `templates/data-repo/schemas/` into the
  Organization's data repository in the same release, before the first write
  of the new App: the data repository's validator refuses the new fields with
  the old schemas.

### For agents

- The page's tools are removed for good even while a refresh waits for the
  server's list: once that refresh settles, the tools it registered go too.
- A record's file changed by hand gets a new `record.revision`
  (`crypto.randomUUID()`) and `record.updatedAt`, as every write of the App
  does (`docs/data.md`, the data repository's `AGENTS.md`).

- The tools for agents are defined once on the server
  (`app/v3/src/server/agent-tools.ts`, `@lazurio/module-kit/tools`) and
  offered on `/mcp` of the Application and to the page (`/api/agent-tools`,
  registered by `@lazurio/module-kit/webmcp`), with the same eight names and
  descriptions as before. Each calls the App's own API, so the role and the
  writer rule decide as for a click; a copy that may not write lists only the
  reading tools. None publishes or sends, and the page has no view tool of its
  own. A tool's answer is now `{ ok, data }` or `{ ok: false, reason, message }`
  instead of `{ refused, reason }`, and a list comes as an object (`items`,
  `customers`, `quotes`, `issues`).
- The page's tools no longer leave unhandled `AbortError` rejections when
  they are removed or asked for again (after `/api/status`, a sign-in, a
  change of language). The browser's WebMCP `registerTool` returns a promise
  that rejects once the kit aborts its signal, and module-kit 0.6.0 leaves it
  unhandled (Lazurio/module-kit#14), so `bun run dev:demo` showed Bun's error
  overlay over the page. `app/v3/src/ui/tools.ts` hands the kit a wrapper of
  the browser's `modelContext` that handles that promise, and a removal or a
  refresh that fails leaves the page with fewer tools, never with an error.

## 0.2.0 — 2026-11-18

Ready as an Application of an Organization (Lazurio decision 0249, Module
Standard `MS-19`), on the stack profile `app-data@2026.12`.

### For people

- A copy that may not write says so on every page and offers no change: no
  new quote, item or customer, no editing, no import, no state change of a
  quote and no draft action; a record's form shows its fields disabled. Its
  WebMCP tools only read. A refused change and a missing application role are
  explained in Czech and English.
- An import of several items that fails while it is being written takes back
  the items it had already written, as far as the data repository allows.
  Every check still runs before the first item is written. A stop of the
  process midway can leave part of an import in the draft; the draft review
  shows every item, and each can be returned (Lazurio/repository-db#45 for an
  atomic write).
- Every change records who made it and by which channel (Module Standard, One
  data port): the person's subject and the channel: `import` for the import,
  otherwise as the caller states it in the `x-lazurio-channel` header (`ui`
  from the interface, `webmcp` from the page's tools). A request that states
  none is `unknown`, never guessed. A draft records them
  through repository-db's `recordOrigin` (an agent's channel as `agent`), a
  publication as `Repository-Db-Actor` and `Repository-Db-Source:
  quotes-v3/<channel>`. A caller without a subject (a local entry) records
  none, and nothing is invented. The agent's command line records its changes
  as `cli` (an import as `import`), without a person; a change nobody stated
  the origin of is `unknown`, source `quotes-v3`. The origin is a hint: it is
  recorded under the draft write gate, and a failure to record it never fails
  a saved write.

### For whoever runs it

- `@lazurio/module-kit` v0.4.0 (profile release `2026.12`).
- Who came, through `appAccess` on every API request and every print page: no
  application role gets `403`. An Application User and an Application Admin
  have the same rights; an Organization that wants finer roles adds them in
  its copy.
- One writer rule through the module kit's `dataWriter`: on an Application host
  only `LAZURIO_RUNTIME_DATA_WRITER=true` writes; any other value refuses every
  change with `data_read_only` before it reaches the store. Without the
  variable the App follows the module kit (the Module Standard keeps that case
  open), except that a runtime stating `LAZURIO_RUNTIME_DEPLOYMENT=production`
  never writes without `true`, from any entry. A copy that may not write
  changes no record and never fetches, pulls or publishes, not even on a read;
  it reads its draft status from the checkout, and watches the checkout so an
  open page hears when the host updates the replica. Every request that may not
  write gets the store, and the service over it, as a read-only view
  (`readOnly` of the storage port), so a change is refused at the port too.
  `/api/status` tells the page `mayWrite` for the request.
- Deep health: `/healthz` answers 503 until the data checkout is open, then 200.
- Contract tests (`tests/application-contract.test.ts`) over the module kit's
  testing helpers.

## 0.1.0 — 2026-11-09

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
- The design system is the package `design-system`
  (`github:LazurioTemplates/design-system#v2.0.0`): the App uses its styles,
  tokens and React components, the print page its tokens and fonts; the
  Organization's own design system replaces it by changing the dependency.
- One gate, `bun run check`, on Ubuntu and Windows.
