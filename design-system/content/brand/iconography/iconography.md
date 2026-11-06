---
title: Iconography
description: Icon style, sizes and when an icon may stand alone.
order: 7
---

# Iconography

## Style

- **Outline icons** with a `stroke-icon` stroke, drawn at `size-icon-lg`,
  round caps and joins. One open
  source set for the whole Organization (for example Lucide, ISC licence);
  never mix sets.
- Icons are drawn in the colour of the text next to them (`currentColor`).
  They only take a status colour when they *are* the status, and then the word
  is next to them too.

## Sizes

| Size | Use |
|---|---|
| `size-icon-sm` | Inside `body-sm` text, table cells, badges |
| `size-icon-md` | Buttons, inputs, navigation |
| `size-icon-lg` | Empty states inside cards, toolbars |
| `size-icon-xl` | Empty states of a whole page |

Spacing between an icon and its label is `space-1` (`size-icon-sm` icons) or
`space-2`.

## Meaning

| Meaning | Icon |
|---|---|
| Hypothesis | flask |
| Verified signal | badge-check |
| Guardrail | shield |
| Stop or scale decision | git-fork |
| Publish (irreversible) | send |
| Draft | file-pen |
| Source | link |
| Warning | triangle-alert |
| Error | circle-x |

## Rules

- An icon alone is allowed only for universally known actions (close, search,
  more) and then it has an accessible name (`aria-label`) and a tooltip.
- Decorative icons are hidden from assistive technology (`aria-hidden="true"`).
- No emoji in the interface, documents or slide titles.
