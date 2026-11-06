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
- **Look and feel of the App.** `app/v3/src/instance/` is the Organization's
  overlay: `brand.ts` and `theme.css`. Keep shared styling in
  `app/v3/src/ui/styles.css` and `app/v3/src/design-system/`.

Run `bun run check` and `bun run build` in `app/v3` before every pull request.

## The look of the quote document

The quote a customer receives takes its colours, type and spacing from
`design-system/` at the Module root: a release of
[LazurioTemplates/design-system](https://github.com/LazurioTemplates/design-system)
merged as a subtree (v1.0.0 in this release), never a copy of its files.
`app/v3/src/document/theme.ts` is the one file that names it: it imports the
design system's own `tokens.ts`, which reads its own `tokens.json`. The
document's stylesheet (`document-css.ts`) uses only the design system's role
names; a test fails on a colour of its own or a name the design system does
not define.

- **A newer release of the design system** (for example 2.0.0) arrives as a
  merge of its tag into the subtree, in a pull request of its own:

  ```bash
  git fetch https://github.com/LazurioTemplates/design-system.git "refs/tags/<tag>"
  test "$(git rev-parse 'FETCH_HEAD^{commit}')" = "<commit from the registry>"
  git merge -X subtree=design-system/ --no-ff -m "Design system: take release <tag>" <commit>
  ```

  If the release moved its tokens or changed the interface of `tokens.ts`,
  change `theme.ts` in the same pull request; `bun run check` says whether the
  document still finds every role it uses. A release of Quotes that takes a
  newer design system does exactly this, so an adopted Module usually gets it
  by merging the Quotes tag instead.
- **The Organization's own design system** (an adopted
  `<Organization>/design-system` with its own brand) replaces the subtree in a
  pull request: `git rm -r design-system`, then the same subtree merge of the
  Organization's commit (`git merge -s ours --no-commit
  --allow-unrelated-histories <commit>` and `git read-tree
  --prefix=design-system/ -u <commit>`), so later releases of it arrive as
  merges too. From then on, when a Quotes release changes `design-system/`,
  keep the Organization's side.

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
  `src/instance/`, its `AGENTS.md` section, a design system of its own) stays
  the Organization's; the rest usually takes the template's side.
- Read the release's `CHANGELOG.md` section: when the schemas changed, the data
  repository gets the regenerated `schemas/` (and any migration) in a pull
  request of its own, merged together with the Module's.
- `bun install --frozen-lockfile && bun run check && bun run build`, then a
  pull request. Merging it is the person's Publication.

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
`@lazurio/repository-db` words its Draft & Publish card in English, the App's
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
