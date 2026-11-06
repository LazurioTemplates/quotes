---
title: Foundations
description: The brand, voice, colour, type, spacing and icon rules every output starts from.
order: 1
---

# Foundations

Everything visual starts here. Components, patterns and templates only combine
these foundations; they never add a colour, a font size or a spacing value of
their own.

| File | Holds |
|---|---|
| [`brand.md`](brand.md) | The brand in one paragraph, the wordmark and the visual principles |
| [`voice-and-tone.md`](voice-and-tone.md) | How the interface and documents sound, with do and don't examples |
| [`colors/tokens.json`](colors/tokens.json) | **The source of truth** for colours, themes, type, spacing and radius |
| [`colors/palette.md`](colors/palette.md) | The colour roles and when to use each |
| [`typography/typography.md`](typography/typography.md) | Typefaces, the type scale and its rules |
| [`layout/spacing-and-radius.md`](layout/spacing-and-radius.md) | Spacing, radius, sizes, strokes, layout widths, breakpoints and motion |
| [`iconography/iconography.md`](iconography/iconography.md) | Icon style, sizes and meaning |

The values themselves live only in `colors/tokens.json`: colours, type,
spacing, radius, sizes, strokes, widths, breakpoints and motion. The Markdown
files name tokens (`text-muted`, `space-4`, `h2`, `size-control`) and explain
when to use them; they never state a value in px or ms, and a test refuses one.
The viewer renders the values on its **Tokens** page and its CSS reads them as
custom properties. Two things in the viewer's CSS are not tokens, and tests
bound both: its media queries repeat the breakpoints, because CSS cannot read a
custom property there, and a test keeps them equal to `breakpoint`; and the
viewer's own geometry (the frames of its gallery, tokens page and example
screens), which is not part of the design system, is declared once as
`--viewer-*` and is the only other place with a px value. When a value changes, change `tokens.json` (and, for a
breakpoint, those media queries) and nothing else.

All of this is fictional: Example is an invented Organization, and its brand
shows what a complete design system looks like. An Organization that adopts
the template replaces it with its own (`docs/adoption.md`).
