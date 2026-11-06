# Extending the design system

How to keep developing this module after you adopted it, how it would change
generation, how to take a newer release of the template, and how the
template itself is released. For the first adoption see
[adoption.md](adoption.md).

## Generation and stack profile

The App is generation **`app/v1`**. In Lazurio a generation names the data
layer, not quality: v1 and v2 have no data of their own, v3 keeps data in
repository-db, v4 in a Dolt database. The design system's content is
Markdown and `tokens.json` in Git, edited through pull requests, so it has no
data of its own and stays `app/v1`.

The tools follow the stack profile **[`content@2026.11`](https://github.com/Lazurio/LazurioPlatform/blob/main/docs/stack-profiles.md#content)** of Lazurio,
shared by the Marketplace templates built on Astro (design system, website,
knowledge base). The profile defines the pins below except
`@astrojs/markdown-remark`, which this App adds for its rehype plugin:

| Tool | Version | Why |
| --- | --- | --- |
| Bun (`packageManager`, runtime, tests) | 1.4.4 | The App's runtime in Lazurio; `bun test` needs no other test runner |
| Astro | 7.4.5 | Static build, content collections |
| `@astrojs/markdown-remark` | 7.3.5 | The `unified()` Markdown processor; the viewer rewrites links between content files with a rehype plugin |
| `@astrojs/check` | 0.9.12 | Type check of `.astro` files |
| TypeScript | 6.0.3 | `astro check` does not support TypeScript 7 yet |
| Biome | 2.6.4 | Lint and format in one tool |
| `@lazurio/module-kit` | 0.2.0 | Listener, shutdown and development server options |

Every dependency is pinned exactly (no `^` or `~`) and `bun.lock` is
committed; the template test fails on a range. As the profile asks, Biome
lints and formats the TypeScript, JSON and CSS of the App, leaves `.astro`
files out, and keeps its Markdown and YAML formatters off.

## Changes within the generation

Most work is here and needs no plan beyond an ordinary pull request:

- **Content.** Edit Markdown in `content/` and values in
  `content/brand/colors/tokens.json`. Name tokens in text (`text-muted`,
  `space-4`), never a value in px or ms. Every page needs front matter with a
  `title`.
- **Components and screens.** `app/v1/src/components/ui/` is a reference
  implementation for the gallery and the example screens; change a component
  together with its page in `content/components/`.
- **The viewer.** `app/v1/src/` renders `content/`; it stays read-only and has
  no authoring UI.

Before the pull request run, in `app/v1`:

```sh
bun install --frozen-lockfile
bun run check      # astro check, Biome and every test, the build included
```

The tests hold the design system's rules: the shape of `tokens.json`, WCAG
AA contrast of every role pair the components use in both themes, the pages
of every layer and their links, no literal colour or dimension in the viewer,
paths that check out on Windows, the start and build contracts of the Lazurio
Module Standard and the template contract (licence, documents, exact pins,
screens).

## When the module would change generation

Only when it gets data of its own. An example: the Organization wants people
to edit tokens or components in a form, with a draft that someone reviews and
publishes, instead of editing files in pull requests. Then the data moves to
repository-db and the App becomes `app/v3`:

1. A new `app/v3/` appears beside `app/v1/`, on the stack profile for Apps
   with data. `app/v1` stays the default and the way back.
2. The data gets a schema and a migration script that moves today's content
   into repository-db and checks that nothing was lost.
3. `default_app` in `lazurio.module.json` switches to `app/v3` only on the
   decision of the Organization's Steward or the person, never as a fix.
4. The module keeps at most two generations; after the switch has held, the
   old one is deleted in a pull request (Git history keeps it).

A move to `app/v2` brings nothing: v2 also has no data of its own.

## Taking an update of the template

A newer release of this template reaches an adopted module as a merge of its
tag, never as a copy. In a task worktree of the module:

```sh
git fetch template tag v<version>
test "$(git rev-parse 'v<version>^{commit}')" = "<commit from the Marketplace registry>"
git merge --no-ff -m "Design system: take template release v<version>" 'v<version>^{commit}'
```

Read the release's `CHANGELOG.md` entry first; it says what changed and what
to do. When files conflict, keep the module's identity (`lazurio.module.json`,
the `lazurio.runtime` id and names, `REPOSITORY`) and its own brand and
content, and take the template's tooling (dependencies, `bun.lock`,
configuration, tests, workflow). Then run `bun install --frozen-lockfile` and
`bun run check`, and open a pull request that names the release and its
commit. Declining the pull request keeps the module as it was; an undo is a
reviewed revert, never a reset.

## Releasing the template

This part is for the maintainers of `LazurioTemplates/design-system`.
A release is an annotated tag `v<semver>` on `main` and a GitHub Release; the
Marketplace registry records the full commit of the tag. Creating the tag and
the Release is a Publication and waits for the maintainer's explicit
instruction.

The version is semantic and independent of the generation:

- **major**: an adopted module must change its own files to take it: the
  shape of `tokens.json`, moved or renamed files, a new generation, a stack
  profile release that breaks code;
- **minor**: new components, pages, tokens or tests, or a stack profile
  release that needs no change in adopted modules;
- **patch**: fixes, and patch versions of tools for a security fix.

Tool versions change only in two planned ways: a **profile release** of
Lazurio (`YYYY.MM`: new versions of the tools within the generation, for
example TypeScript 7 once `@astrojs/check` supports it) and a **generation
change** (the data layer). Besides these, only a patch version with a security
fix changes. The template adopts a profile release as a release of its own and
names the profile release in `README.md` and `CHANGELOG.md`; adopted modules
take it by merging that tag.

Before a release:

1. Update `CHANGELOG.md` and `version` in `app/v1/package.json`.
2. Refresh the screens in `docs/screenshots/` when the App looks different:
   WebP, 1600 px wide, taken from the static build at twice the pixel density
   of a 1440 × 900 window and scaled down, invented content only. The first
   file of the registry's list is the Marketplace card.
3. Run `bun run check` and wait for green CI on `main`.
4. On the instruction: `git tag -a v<version> -m "v<version>"`, push the tag,
   `gh release create v<version> --verify-tag`, then a pull request to the
   registry (`Lazurio/marketplace`) with the tag's full commit.

## Templates that build on the design system

The design system is the visual source for the other templates of the
Organization. They take it the same way, as a reviewed snapshot, never as a
path into this repository at run time (the Lazurio Module Standard forbids
imports from another repository, and the design system is not a package):

- **Website** (a planned template, Astro on the same content stack profile).
  It copies `content/brand/colors/tokens.json` into its own repository with a
  lock file that names this repository, the commit and the file's SHA-256,
  turns the roles into CSS custom properties the way `app/v1/src/tokens.ts`
  does, and takes the components it needs from `app/v1/src/components/ui/`
  as its own code. A newer design system reaches the website as a reviewed
  pull request that refreshes the snapshot and the lock.
- **Knowledge base** (`app/v2`, Astro with Starlight). It is where the
  Organization keeps its brand brief and strategy, which the design system
  mirrors (`BASELINE.md` names it as the brand source once it holds them);
  tone comes from the voice guide of the Organization root
  (`content/brand/voice-and-tone.md`). Its theme may take the tokens the same
  snapshot way.
- **Presentations** (`app/v1`, Vite and React). Its slides and documents
  follow `content/templates/` and the tokens through the same kind of
  snapshot with a lock.

Agents use the design system without any copy: before visual or formatted
work they read `BASELINE.md`, `tokens.json` and the page for the output
(`AGENTS.md` lists which). When a website or another production source and
the design system disagree, production wins and the design system is updated.
