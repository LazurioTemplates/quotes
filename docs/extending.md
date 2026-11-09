# Extending Quotes

An Organization that adopted Quotes owns its copy and changes it freely. Two
things keep the copy healthy: changes within the App generation stay behind
the storage port, and the code moves only along the planned steps below.
Lazurio Marketplace templates allow exactly two kinds of change to their
stack: a **generation move** (the data layer changes) and a **stack profile
release** (tool versions change). Anything else is a patch release with a
security fix.

## Changes within generation v3

- **A new field or record rule.** Change the Zod schema in
  `app/v3/src/domain/`; the TypeScript type follows by itself. Add a new field
  as optional so existing records stay valid, or ship a migration of the data
  in the same release. Run `bun run schema:export` and copy the regenerated
  `templates/data-repo/schemas/` into the Organization's data repository in a
  pull request of its own. Update both starts in `app/v3/seed/`.
- **A rule across records** belongs to `app/v3/src/domain/rules.ts`; **a rule
  of the check before sending** to `app/v3/src/domain/checks.ts`. Both speak
  Czech and English and have their tests.
- **A new operation on the data** is a method of the storage port
  (`app/v3/src/data/store.ts`) named by the domain (`archiveItem`, not
  `moveFile`), implemented in every store and covered by
  `tests/store-contract.ts`. The server, the service and the command line call
  only the port.
- **A new page** is a React component in `app/v3/src/ui/pages/` and a route in
  `routes.ts`; it calls only the HTTP API (`app/v3/src/ui/api.ts`) and writes
  every text in both languages. An action people do often gets a WebMCP tool in
  `app/v3/src/ui/tools.ts`.
- **The process.** When the way the Organization prices or quotes changes,
  change the skills in `.agents/skills/` and copy them to `.claude/skills/`
  (a test keeps them identical), and say the Organization's own rules in its
  section of `AGENTS.md`.
- **Look and feel of the App.** The look is the design system's (next
  section). `app/v3/src/instance/` is the Organization's overlay of this App:
  `brand.ts` and `theme.css`. Keep the App's own layout in
  `app/v3/src/ui/styles.css`, with the design system's tokens only.

Run `bun run check` and `bun run build` in `app/v3` before every pull request.

## The look of the App and the quote

The App and the quote a customer receives take their look from the
Organization's design system, the package `design-system`, a dependency of
`app/v3/package.json` on a released tag. This template depends on
`github:LazurioTemplates/design-system#v2.0.0`; `bun.lock` records the tag's
commit and the archive's `sha512`, and `bun install --frozen-lockfile`
installs exactly that. No file of the design system lives in this
repository, and nothing imports it by a relative path (Module Standard).

- **The App** imports `design-system/styles.css` once in
  `app/v3/src/ui/main.tsx` and uses the package's React components
  (`design-system/react`): buttons, badges, alerts, tables, fields,
  checkboxes, the navigation, cards and empty states. `src/ui/styles.css`
  holds only the App's own layout and names only the package's `--ds-*`
  tokens; `src/ui/locale.ts` takes the language by the package's
  `resolveLocale()` and `readLazurioLocale()`.
- **The quote document** is HTML the server renders, outside the App's
  bundle: `app/v3/src/document/theme.ts` takes the tokens from
  `design-system/tokens` and writes them as the same `--ds-*` custom
  properties, and the print page serves the package's fonts. The document's
  stylesheet (`document-css.ts`) names only those tokens. Tests fail on a
  colour of its own, on a token name the package does not declare, and on a
  copy of the design system in the Module.
- **A newer release of the design system** is a new tag in the dependency:
  change `#v2.0.0`, run `bun install` and `bun run check`, read the release's
  `CHANGELOG.md`, look at the pages and the print in both languages, and open
  a pull request that names the release.
- **The Organization's own design system** (an adopted
  `<Organization>/design-system`, which carries the Organization's brand)
  changes only the dependency line:
  `"design-system": "git+ssh://git@github.com/<Organization>/design-system.git#v<version>"`;
  the imports stay the same, because both packages are named
  `design-system`. A new brand is a new release of that design system and a
  new pin here.
- **Known limitation:** the Organization's design system is a private
  repository, which `git+ssh` installs on an Environment with the person's
  SSH key, but the Module's GitHub Actions cannot install it until the
  Organization gives them read access to it. How a Module's CI reaches an
  Organization's private package is open in
  [Lazurio/LazurioPlatform#915](https://github.com/Lazurio/LazurioPlatform/issues/915);
  until then CI of such a Module fails at `bun install`, and the check runs on
  the Environment.

## Sending a quote through the Organization's Integration

Quotes never sends anything: sending a quote is a Publication and stays the
person's. The App and its agents prepare everything for it:

1. the check passes (`bun run quotes quote:check <number>`, or the panel on
   the quote's page);
2. the PDF: the print page `/print/quotes/<id>?lang=<cs|en>` saved by the
   browser, or by an agent with `agent-browser … pdf` (see
   [`agents.md`](agents.md)), under the name `quote:email` gives;
3. the e-mail: recipient, subject and text from the Organization's template in
   the settings (`bun run quotes quote:email <number> --json`).

An Organization that wants its agents to put this into a mailbox uses its own
Integration of the Environment, never a credential in the Module: `lazurio
integrations list --json` says which one is connected and by which path
(a tool from Settings → Tools, the Environment's Executor, or Composio). The
agent shows the person the exact message (recipient, subject, full text, the
attachment), creates it as a **draft** in the Organization's mailbox on their
word, and the person sends it. Sending it directly is allowed only where the
person approved that exact message and the Organization's rules allow agents
to send. After the quote went out, "Označit jako odeslanou" (mark as sent),
or `bun run quotes quote:act <number> send`, locks the version.

An Organization that wants a button for this in the App adds it as an
operation that prepares the draft through the same Integration path on the
server of the Environment, never with a key in the Module (the Module Standard
allows secrets only from the Environment's vault), and keeps the final send a
person's step.

## Taking a template release

Later releases of the template arrive as merges, never as copies, rebases or
squashes. The release that was adopted is an ancestor of the Organization's
`main` (see [`adoption.md`](adoption.md)), so Git knows what the Organization
changed and what the template changed.

```bash
git fetch https://github.com/LazurioTemplates/quotes.git "refs/tags/<tag>"
test "$(git rev-parse 'FETCH_HEAD^{commit}')" = "<commit from the release notes or registry>"
git switch -c take-<tag> origin/main
git merge --no-ff <commit>
```

- Resolve conflicts hunk by hunk. The Organization's identity
  (`lazurio.module.json`, `lazurio.runtime` ids, `config/data-repository.json`,
  `src/instance/`, its `AGENTS.md` section, the dependency on its own design
  system) stays
  the Organization's; the rest usually takes the template's side.
- Read the release's `CHANGELOG.md` section: when the schemas changed, the data
  repository gets the regenerated `schemas/` (and any migration) in a pull
  request of its own, merged together with the Module's.
- `bun install --frozen-lockfile && bun run check && bun run build`, then a
  pull request. Merging it is the person's Publication.

## Languages

Every text people see is written in Czech and English side by side
(`t("Ceník", "Price list")` in the UI, `pick(locale, cs, en)` on the server).
The App takes its language from `?lang=` in the address, then from the
person's Lazurio profile in `/.lazurio/shell.json`, then from `language` of
the Module's settings, then Czech (`app/v3/src/ui/locale.ts`); the server
answers in the language the page asks for (`Accept-Language`), the print page
in `?lang=`, the command line in `--lang` or the settings' language. Lazurio
relays `/.lazurio/shell.json` only on its own origins today, so on a module's
origin the settings decide; when it hands modules the person's language
([LazurioPlatform#909](https://github.com/Lazurio/LazurioPlatform/issues/909)),
the App follows it without a change. A third language is a third string in
every pair and a third start in `app/v3/seed/`: a template release, not a
change of one Organization's copy.

## Stack profile releases

The template follows the stack profile [`app-data@2026.11`](https://github.com/Lazurio/LazurioPlatform/blob/main/docs/stack-profiles.md#app-data):
exact versions of Bun, TypeScript, Vite, React, Biome, Zod, repository-db and
module-kit (see `app/v3/package.json`). A **stack profile release** moves
those versions together, for example `app-data@2026.11` to `app-data@2027.05`:
one template release that updates `packageManager`, the exact versions,
`bun.lock`, the CI's Bun and, if the formatter changed, reformats once.
Organizations take it by merging its tag like any other release. Between
profile releases only patch versions with a security fix change.

Known for later profile releases: Vite+ is reconsidered when it supports Bun
as a runtime and its formatter reaches 1.0; Biome's YAML and Markdown
formatting stays off until a profile release turns it on. When
`@lazurio/repository-db` words its Draft & Publish card in English
([Lazurio/repository-db#40](https://github.com/Lazurio/repository-db/issues/40)), the App's
own card (`app/v3/src/ui/components/DraftCard.tsx`) returns to the engine's
`DraftPublishPanel`.

## The move to generation v4 (Dolt)

Generation v4 keeps the data in a Dolt database in the Organization's services
Environment instead of a Git data repository; it fits an Organization where
many people quote at once or an outside system writes prices. The move is
planned, reviewed and reversible:

1. **A new App beside the old one.** Create `app/v4/` from `app/v3/`:
   `src/domain/`, `src/service/`, `src/server/`, `src/ui/`, `src/document/`
   and `tests/store-contract.ts` are copied unchanged. Add
   `src/data/dolt-store.ts`, the storage port over Dolt (Kysely 0.29.8 and
   mysql2 3.24.6 per the profile `app-database`), and SQL migrations derived
   from the Zod schemas. Settings, categories, items, customers and quote
   versions are flat records with a stable id, so they map to rows; the lines
   of a quote and the price history of an item become tables of their own.
2. **Draft & Publish stays the same for people.** A draft is the person's
   working set or branch, publishing is `DOLT_COMMIT` with the author and a
   summary, the review comes from Dolt's diff tables. This mapping is to be
   proven on a prototype before the first v4 release.
3. **The same tests.** `tests/store-contract.ts` runs against Dolt in CI, with
   a pinned `dolt sql-server`. A store that passes the suite replaces the v3
   store without a change to the server, the UI or the command line.
4. **Moving the data.** `bun run migrate:v3-to-v4` reads every record through
   the v3 store, validates it with the same Zod schemas, writes it to Dolt and
   makes one `DOLT_COMMIT` naming the source commit of the v3 data. It proves
   the counts and a round trip of every record, amounts to the haléř.
5. **Switching.** `lazurio.module.json` lists both Apps; `default_app` moves
   to `app/v4/package.json` only on the decision of the Organization's Steward
   or the person. `app/v3` stays as the way back until that decision is final;
   a Module keeps at most two generations.

Do not confuse the two meanings of "v4": the App generation `app/v4` (Dolt)
and a repository-db data branch named `v4`. Write "App generation" and "data
branch". Generation v5 is a setting of v4 (Dolt hosted outside one server),
not an `app/v5`.
