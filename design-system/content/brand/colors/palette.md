---
title: Colour
description: The colour roles of the light and dark themes and when to use each.
order: 4
---

# Colour

Source of truth: [`tokens.json`](tokens.json). It holds two layers:

- **primitives** (`colors`): the raw palette, named by hue and lightness
  (`graphite-600`, `signal-500`, `lumen-400`). Nobody uses a primitive
  directly.
- **roles** (`themes.light`, `themes.dark`): what a colour is *for*. Every
  component, template and document uses roles only, so dark mode and a future
  palette change are one edit in `tokens.json`.

## The families

| Family | Character | Used for |
|---|---|---|
| Graphite | Cool neutral grey, slightly blue | Surfaces, text, borders |
| Signal | Deep, calm blue | The primary action, links, the selected item, info |
| Lumen | Warm light yellow | Focus on dark backgrounds, highlights, "what changed" |
| Green | Clear, not neon | Verified signal, success |
| Amber | Ochre, readable | Hypothesis, warning, needs attention |
| Red | Brick, not alarm-red | Danger, error, stopped |

## Roles

| Role | Meaning | Typical use |
|---|---|---|
| `surface` | The page background | App background, slide background |
| `surface-raised` | Something that sits on the page | Cards, dialogs, table body, inputs |
| `surface-sunken` | A recessed area | Code blocks, table header, read-only fields |
| `text` | Primary text | Headings, body, values |
| `text-muted` | Secondary text | Descriptions, labels, table headers |
| `text-subtle` | Tertiary text | Hints, timestamps, placeholders |
| `border` | A quiet divider | Card edges, table rows |
| `border-strong` | A boundary that must be seen | Input borders, the outline of secondary buttons |
| `accent` | The one primary action | Primary button, selected tab, progress |
| `accent-hover` | The primary action, hovered or pressed | Primary button hover |
| `on-accent` | Text and icons on `accent` | Primary button label |
| `accent-text` | Accent as text | Links, the active navigation item |
| `accent-subtle` | A quiet accent background | Selected table row, info toast |
| `focus` | The keyboard focus ring | Every focusable control |
| `highlight` | Attention, not action | "New" marker, changed value underline |
| `on-highlight` | Text on `highlight` | The label inside a highlight marker |
| `success`, `success-subtle` | Verified signal, success | Badge text and background, success toast |
| `warning`, `warning-subtle` | Hypothesis, needs attention | Badge, warning toast, budget near limit |
| `danger`, `danger-subtle` | Error, destructive, stopped | Error text, destructive button, error toast |
| `scrim` | The shade behind and below overlays | Never solid: mixed with transparency for the dialog backdrop (60 %) and overlay shadows (12–24 %) |

## Rules

- **Text contrast is at least 4.5:1** and boundaries of controls and the focus
  ring at least 3:1, in both themes. `app/v1/tests/tokens.test.ts` checks every
  pair the components use; a palette change that breaks one fails CI.
- **One accent per view.** If two things look primary, one of them isn't.
- **Status never relies on colour alone.** A badge, toast or chart label always
  carries the word.
- **Lumen is not text.** Use `on-highlight` on top of it; never put lumen text
  on a light background.
- **Dark theme is not inverted light theme.** It has its own role mapping:
  raised surfaces get lighter, the focus ring turns to lumen, and links use a
  lighter signal.
