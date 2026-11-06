# Design system: rules for agents

This repository is a design system module with an invented brand, Example.
These rules add to the Organization root `AGENTS.md`.

Before any visual or formatted work, use the Organization skill
`design-system-lookup`. At minimum read `README.md`, `ARCHITECTURE.md`,
`INITIALIZATION.md` and `BASELINE.md`.

## Source of truth

In order of authority:

1. Production sources of the Organization (website, production UI, brand
   brief).
2. Explicit brand and voice documents (the knowledgebase module and
   `company/agents/voice/` in the Organization root).
3. This design system as the unified, reviewable layer.

When the design system disagrees with production, production is right and the
design system is updated.

## Which file for which output

Read `BASELINE.md` and `content/brand/colors/tokens.json` first, always. Then:

| You are producing | Read |
|---|---|
| Any visual output | `content/brand/brand.md`, `content/brand/colors/palette.md` (roles, never primitives) |
| A document, report or research brief | `content/writing/documents.md`, `content/templates/document/research-brief.md`, `content/brand/typography/typography.md` |
| A presentation | `content/templates/presentation/experiment-review.md`, `content/brand/layout/spacing-and-radius.md` |
| An e-mail | `content/templates/email/experiment-update.md` and `.html`, `content/writing/ui-text.md` |
| A screen, page or component of an App | `content/components/<component>.md`, the matching `content/patterns/*.md`, and the example screens in `content/examples/screens/` |
| Interface text (buttons, errors, empty states) | `content/writing/ui-text.md`, `content/writing/terminology.md` |
| Anything that sends, publishes, pays or deletes | `content/patterns/irreversible-actions.md`: prepare a Draft, act only after "Publish" |
| Tone of any text | `content/brand/voice-and-tone.md`; the source of truth is `company/agents/voice/` in the Organization root |
| An adoption of this template into another Organization | `docs/adoption.md` |
| A change of tools, a generation change, a release or a template update | `docs/extending.md`, `CHANGELOG.md` |

Use tokens by name (`text-muted`, `space-4`, `h2`); never invent a colour,
size or spacing value. If what you need is missing, say so and propose the
addition as a pull request here instead of improvising it in the output.

## What belongs here

- the brand baseline and design tokens;
- typography, colour, spacing and layout rules;
- reference examples for web, slides, documents, tables and merchandise;
- templates and starters for repeated formats.

## What does not belong here

- secrets, API keys or OAuth session data;
- moodboards without a link to the production brand;
- a production authoring UI;
- large exports without metadata or a clear source of truth;
- copies of another company's brand assets.

## Lazurio Module Standard

- One repository is one module; the viewer App lives in `app/v1/`.
- `dev` starts one Astro server; `prepare:app` (`astro sync`) is the
  preparation and `check:prepared` checks it.
- Opened from `main`, the App runs as its static build (`build_output:
  "dist"`, Module Standard 4.5). `build` (`astro build`) must succeed without
  the listener and write `dist/index.html` for the health path `/`; the static
  build stays in `build`, never in `prepare:app`. The build contract test
  checks both.
- The App reads its host and port only from
  `LAZURIO_RUNTIME_LISTENER_APP_HOST` and `_PORT` through `@lazurio/module-kit`
  and exits with code 2 without them. The port lives only in
  `lazurio.module.json`.
- No `.env*` files, secrets or imports from outside this repository.
- One change, one worktree, one branch, one pull request; the primary checkout
  stays on `main`.

## Template

This repository is a public template of the Marketplace of Lazurio (MIT,
`LICENSE` and `NOTICE`), published by LazurioTemplates. Everything in it must
stay publishable:

- only the invented brand Example; never a real
  company's brand, content, customers or data, and never a font, image or
  icon file without a license that allows it (record it in `NOTICE`);
- the App stays generation `app/v1` (no data of its own) on the content stack
  profile with exact versions; tool versions change only in a stack profile
  release or a generation change (`docs/extending.md`);
- a change that adopted modules must follow in their own files is a major
  release and says what to do in `CHANGELOG.md`;
- keep `docs/adoption.md` and `docs/extending.md` true when you change what
  they describe, and refresh `docs/screenshots/` when the App looks different;
- tags, GitHub Releases, merges and the registry entry are Publication: only
  on the maintainer's explicit instruction.

## Verification before a pull request

```sh
cd app/v1
bun install --frozen-lockfile
bun run check      # astro check, Biome and every test, the build included
lazurio module setup <path to the module> --root <Lazurio Folder> --json
```

The expected `module setup` status is `current`.
