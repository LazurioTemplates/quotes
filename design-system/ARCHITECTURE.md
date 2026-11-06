# Design system architecture

## Role

The design system:

- extracts reusable truths from the Organization's production sources;
- holds the canonical tokens and brand rules;
- gives agents a repeatable workflow;
- makes visual outputs reviewable in Git;
- offers a read-only viewer for a quick preview.

## Authority model

Default precedence:

1. the website or another production presentation layer;
2. the knowledgebase or another brand or strategy source of truth;
3. the Organization voice guide for tone;
4. this design system as the curated baseline.

The design system never overrides production reality because a newer idea
looks better.

## Layers

### Foundations (brand baseline)

`content/brand/` holds `colors/tokens.json`, the one source of truth for every
value: the primitive palette (`colors`), the colour roles of the light and
dark themes (`themes`), the type scale, spacing and radius. Next to it,
`brand.md`, `voice-and-tone.md`, `colors/palette.md`,
`typography/typography.md`, `layout/spacing-and-radius.md` and
`iconography/iconography.md` explain when to use which token, by name and
without repeating values. Logos and assets go here when they exist and may
live in Git.

### Components, patterns and writing

`content/components/` describes the basic components, each page with the same
sections (purpose, anatomy, variants, states, usage, content, accessibility,
tokens). `content/patterns/` combines them for recurring problems, including
Draft and Publish for irreversible actions. `content/writing/` holds the rules
for interface text and documents and the terminology list. They use tokens by
name only.

### Examples

`content/examples/` holds references across categories. Every serious asset
has a sibling Markdown file with the metadata `title`, `source`, `date`,
`category` and `notes`.

### Templates

`content/templates/` holds starters for repeated formats. A template generated
from another module names its primary source.

### Viewer App

`app/v1/` is a read-only Astro viewer that follows the Lazurio Module
Standard:

- its only lease `main` lives in `lazurio.module.json`, inside the
  Organization port pool; the App reads it from the listener environment
  through `@lazurio/module-kit`, and the config reads it only when Astro
  serves, never during `astro build`;
- opened from `main`, it runs as its static build (`build_output: "dist"`,
  Module Standard 4.5): the Launchpad runs `build` (`astro build`, without the
  listener), serves `dist/` with its own small static server and builds again
  after a pull; `dev` (one Astro server) is the preview from a worktree or an
  explicit development start;
- it has no authentication and no authoring UI;
- it renders `content/`: every Markdown file is a page at its path (an Astro
  content collection, `src/content.config.ts`), and relative links between
  files are rewritten to those pages (`src/lib/md-links.ts`);
- `src/tokens.ts` reads and validates `content/brand/colors/tokens.json` at
  build time and turns its roles into CSS custom properties for both themes;
- `src/components/ui/` is a reference implementation of the components for
  the Gallery and the example screens, not a published package;
- the tests check the token contract, WCAG AA contrast of every role pair the
  components use, the content contract of every layer and that every page is
  in the build.

## Place in the Organization

The design system is a root-level module of the Organization (slot
`design-system`, mounted at `design-system/` next to `workspace/`). Apps of
other modules use its brand assets as a versioned dependency, never through a
relative path into this repository.

## Invariants

- The design system is a standalone repository, never a submodule.
- Another company's brand assets are never copied.
- Secrets never belong here.
- Production takes precedence over the curated mirror.
- The viewer stays read-only.
- Values live only in `tokens.json` (colours, type, spacing, radius, sizes,
  strokes, widths, breakpoints, motion); Markdown names tokens and never
  states a value in px or ms. The viewer's CSS reads them as custom
  properties. It has px values in exactly two places: its media queries,
  which repeat the breakpoints because CSS cannot read a custom property
  there, and its own geometry, which is not part of the design system and is
  declared once as `--viewer-*`. Tests enforce all of it.
