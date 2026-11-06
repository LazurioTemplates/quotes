# Changelog: design system

From 1.0.0 a release is an annotated tag `v<semver>` with a GitHub Release,
and the version is independent of the App generation (`docs/extending.md`).
The dated entries below (`YYYYMMDD`) come from before the template.

## 1.0.0 — 2026-11-03

The first release as a public template of the Marketplace of Lazurio. The App
stays generation `app/v1`.

### Added

- `LICENSE` (MIT) and `NOTICE`: what the license covers, that the brand is
  fictional, and the third-party notes (no font, image or icon file is
  distributed; Inter and JetBrains Mono are named in the font stacks only).
- `docs/adoption.md`: how an agent adopts the template into another
  Organization (live rights, name collision, `lazurio module create`, a merge
  that keeps the release as an ancestor, the Organization's own brand, Teams
  last, nothing published without the person's instruction).
- `docs/extending.md`: changes within the generation, when the module would
  change generation, taking a newer release by merging its tag, the release
  rules, and how the website, knowledge base and presentations templates
  build on the design system.
- Five screens for the Marketplace card in `docs/screenshots/` (WebP, 1600 px,
  invented content).
- Tests for paths that check out on Windows and for the template contract
  (license, documents, exact versions, Bun in CI, screens).

### Changed

- Stack profile `content@2026.11` of Lazurio: Bun 1.4.2 → 1.4.4, Astro 5.18.2 → 7.4.5,
  `@astrojs/check` 0.9.9 → 0.9.12, TypeScript 5.9.3 → 6.0.3, Biome 2.4.15 →
  2.6.4, `@types/bun` 1.4.2 → 1.4.4, and `@astrojs/markdown-remark` 7.3.5 for
  the `unified()` processor that runs the link rewrite. Every version is
  exact. Biome keeps its Markdown and YAML formatters off, as the profile
  asks. The built pages look the same as before (compared pixel by pixel).
- `bun run check` runs the type check, Biome and every test; CI runs only that
  command, with `concurrency` and a timeout.
- README and AGENTS describe the template; the Module Standard link points to
  `Lazurio/LazurioPlatform`.
- Source: `LazurioTemplates/design-system` publishes the template, with fresh
  Git history from the tree of LazurioExampleOrganization/design-system#7. The
  Organization identity is placeholders (`company` `REPLACE-WITH-ORG-NAME`,
  runtime id `replace-with-org-slug-design-system-v1`, port lease 24902), the
  invented brand is called Example (its wordmark already was), and
  `.github/CODEOWNERS` is not part of the template.

### For adopted modules

Nothing yet: this is the first release.

## 20261027

### Added

- A complete fictional design system as the reference example (issue #5):
  foundations (brand, voice and tone, colour roles for light and dark themes,
  type scale, spacing and radius, iconography), eight components with states,
  usage and accessibility, five patterns including Draft and Publish for
  irreversible actions, writing rules and terminology, three templates
  (research brief, review deck, update e-mail) and four example screens.
- The viewer renders every page of `content/`, the tokens of both themes with
  contrast ratios, a gallery of the components and the example screens, with a
  light and dark switch.
- Tests for the token contract, WCAG AA contrast of the role pairs the
  components use, the content of every layer, links between pages and the
  pages of the build.

### Changed

- `tokens.json` moved from a flat draft palette to primitives, theme roles and
  scales (status `reference`).

## 20261020

### Changed

- Opened from `main`, the viewer App runs as its static build instead of the
  Astro development server: `app/v1/package.json` declares `build_output:
  "dist"` and `static_fallback: "404"`, and the Launchpad builds the commit
  (`astro build`), serves `dist/` with its own small static server and builds
  again after a pull (Module Standard 4.5, LazurioPlatform F58). `dev` stays
  the preview from a worktree. A build contract test checks that the build
  succeeds without the listener and that the health path `/` is a file of
  the output.

## 20261016

### Changed

- Split from the Organization root's in-tree `design-system/` into its own
  repository.
- Adopted the Lazurio Module Standard: the viewer moved from `app/` to
  `app/v1/`, is TypeScript only and reads its listener through
  `@lazurio/module-kit`; preparation (`astro sync`) and a single-process `dev`
  are declared; Bun is pinned to 1.4.2 with a fresh `bun.lock`; `bun run
  check` and `bun test` run in CI.
- The colour tokens now have the shape the viewer reads (`name`, `status`,
  `source`, `colors`) and are validated by a test; the viewer shows the draft
  palette it already used.
- README, AGENTS, ARCHITECTURE and the viewer page are in English.
- BASELINE, INITIALIZATION and the brand content (palette, typography,
  examples) are in English; the palette is described as the draft working
  palette in `tokens.json`.

### Removed

- The listener script that read the module's own lease file and the legacy
  `LAZURIO_RUNTIME_HOST/PORT` pair.
