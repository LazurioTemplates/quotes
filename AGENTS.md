# Quotes: rules for agents

This repository is Quotes („Cenové nabídky“), the public upstream
`LazurioTemplates/quotes` and a template of the Lazurio Marketplace (MIT,
fictional data only). Read [`README.md`](README.md) first. Everything written
in this repository is English except the texts people see, which are Czech and
English; every change is a worktree, a branch and a pull request, and merging
is a Publication on the instruction of a maintainer with live GitHub rights on
this repository.

An Organization that adopted this template keeps this file and adds its own
section at the end ("This Organization's copy"): who reviews, where its data
lives, its pricing rules, what it changed. See [`docs/adoption.md`](docs/adoption.md).
In that copy, review and merge follow the Organization's own `AGENTS.md` and
the live rights of its people, not this repository's maintainers.

## Working with quotes (the process)

The Module is one area of work: the price list, customers and quotes. People
work in the App; agents work through the skills, which use `bun run quotes` in
`app/v3` (see [`docs/agents.md`](docs/agents.md)) or the App's WebMCP tools:

| When the person asks to … | Skill |
| --- | --- |
| prepare a quote from a customer's inquiry („připrav nabídku z poptávky“) | [`prepare-quote-from-inquiry`](.agents/skills/prepare-quote-from-inquiry/SKILL.md) |
| update the price list from a supplier's price list („aktualizuj ceník z ceníku dodavatele“) | [`update-price-list-from-supplier`](.agents/skills/update-price-list-from-supplier/SKILL.md) |
| check a quote before it goes out, prepare its PDF and e-mail („zkontroluj nabídku před odesláním“) | [`check-quote-before-sending`](.agents/skills/check-quote-before-sending/SKILL.md) |

The skills live in `.agents/skills/` (Codex) and, byte for byte the same, in
`.claude/skills/` (Claude Code); a test keeps them identical. Rules every
skill keeps:

- **Drafts only.** Every write of an agent is a draft. Publishing the draft to
  the data repository is the person's button in the App, or a publish on their
  explicit instruction.
- **Nothing goes to a customer.** Sending a quote, an e-mail or a PDF is a
  Publication: show the person the exact message and send nothing yourself
  unless the person approves that exact text and the Organization's rules
  allow it.
- **Never invent a price, an item, a VAT rate or a customer's details.** What
  the price list lacks becomes a line with `to_check`; the check stops it until
  a person fills it in.
- **Speak the person's language.** Pass `--lang cs` or `--lang en`, the
  language of your Folder; the output, the checks and the e-mail follow it.

## What belongs here

- The App code, its Zod schemas, the generated JSON Schemas, the data
  repository template, the starts, the skills and the documentation.
- Fictional records only, in `app/v3/seed/` and in tests: no real
  Organization, person, price list, credential, secret, local host path or
  private link. The fictional supplier is Example s.r.o.; customers' e-mails
  use the reserved `.example` domain; identification numbers are zeros. The
  Organization identity in `lazurio.module.json`, `app/v3/package.json`,
  `app/v3/config/data-repository.json` and `app/v3/src/instance/brand.ts`
  stays the visibly generic placeholders (`REPLACE-WITH-ORG-NAME`,
  `Organization`), and so do the Organization's details in the empty start.
- An Organization's real price list and quotes live in its own data
  repository (`<Organization>/quotes-data`, branch `v3`, mounted as `db/`),
  never here.
- The design system is the package `design-system`, a dependency on a released
  tag (`github:LazurioTemplates/design-system#v2.0.0`). Never copy its files
  into this repository or import it by a relative path; a newer release is a
  new tag in the dependency ([`docs/extending.md`](docs/extending.md), "The
  look of the App and the quote"). Use its React components and its `--ds-*`
  tokens; the App's own CSS is layout only.

## How the code is cut

- `app/v3/src/domain/` holds the Zod schemas, the only definition of the
  shape of the data, and pure logic. Types come from `z.infer`; never write a
  second TypeScript type of a record.
- Money is whole haléře (minor units) in `number`s that are safe integers;
  products go through `money.ts` (BigInt, half up). Never multiply or divide
  amounts as floating-point crowns, and never store crowns.
- `app/v3/src/data/store.ts` is the storage port. The server, the service and
  the command line know only the port. No YAML path, file read or Git term
  crosses it.
- `app/v3/src/data/repository-db-store.ts` implements it with
  `@lazurio/repository-db`: reads through `host.read`, writes through
  `host.run` and `Collection.put` with the base revision. Never run Git on the
  data checkout, never keep a second write queue, poll loop or conflict state.
- `app/v3/tests/store-contract.ts` is the shared suite of the port. A change
  of the port's behaviour changes the suite, and every implementation passes it.
- Every text people see is written in both languages side by side:
  `t("Ceník", "Price list")` in the UI, `pick(locale, cs, en)` elsewhere. A
  test renders every page in English and fails on a Czech letter.
- After a change of a schema, run `bun run schema:export` and commit the
  regenerated `templates/data-repo/schemas/` in the same pull request.

## Before a pull request

- `cd app/v3 && bun install --frozen-lockfile && bun run check && bun run build`.
- A change the person sees: check it in a browser with `bun run dev:demo`
  (Czech) and `bun run dev:demo en` with `?lang=en` (English), at 1280 and
  390 px. Never publish an Organization's data while testing.
- Versions are exact (no `^` or `~`). A new version of a tool is a release of
  the stack profile (see [`docs/extending.md`](docs/extending.md)), not a
  drive-by change.
- Add a `CHANGELOG.md` entry.

## Releases

A release is an annotated tag `v<semver>` and a GitHub Release, created only
on the user's instruction. The release version is independent of the App
generation `app/v3`. The Marketplace registry records the full commit of the
tag.
