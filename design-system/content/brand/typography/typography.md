---
title: Typography
description: Typefaces, the type scale and the rules for headings, body text and data.
order: 5
---

# Typography

Source of truth for the values: `typography` in
[`../colors/tokens.json`](../colors/tokens.json).

## Typefaces

- **Sans** (`typography.families.sans`): Inter when installed, otherwise the
  system UI font. Everything except code and raw data.
- **Mono** (`typography.families.mono`): for IDs, code, file paths and raw
  values that must align character by character.

No font files are shipped. Documents and slides name the same stack, so a
machine without Inter falls back to its system font instead of a random serif.

## The scale

| Style | Use |
|---|---|
| `display` | The title of a presentation or a landing hero. Once per surface. |
| `h1` | The page or document title |
| `h2` | A section |
| `h3` | A subsection, a card title |
| `h4` | A group label inside a section |
| `body-lg` | The lead paragraph under a title |
| `body` | Running text. **The minimum size for reading text.** |
| `body-sm` | Dense UI: tables, form hints, metadata |
| `caption` | Labels above values, badges, axis labels |
| `data` | Figures in tables and charts, with tabular numerals |

## Rules

- **Figures are tabular.** Tables, charts and any column of numbers use
  `font-variant-numeric: tabular-nums` and align right.
- **Sentence case** for every heading, button and label. No ALL CAPS except the
  `caption` style of eyebrows, with 0.08 em letter spacing.
- **Line length** of running text between 60 and 80 characters.
- **Two weights** in one view at most (regular and semibold); bold is only for
  a value the reader must not miss.
- **Hierarchy by size and space, not colour.** Headings are `text`, never
  `accent`.
- Units sit after the value with a thin space where the medium allows:
  "3.1 %", "1,240 visits", "[amount] EUR".
