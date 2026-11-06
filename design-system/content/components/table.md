---
title: Table
description: Compares many items by the same attributes.
order: 14
---

# Table

## Purpose

A table compares many items by the same attributes: experiments by status,
sample and result. Use a list or cards when items have different attributes.

## Anatomy

Container (`surface-raised`, `border`, `radius-md`), header row
(`surface-sunken`, `caption` in `text-muted`), body rows (`body-sm`,
`size-row` high, `border` between rows), optional toolbar above (search, filters, the one
primary action) and footer below (count, pagination).

## Variants

| Variant | Use |
|---|---|
| **Default** | Up to ~200 rows, paginated beyond |
| **Compact** | `size-row-compact` rows for dense operator views |
| **Selectable** | A checkbox column for bulk actions |

## States

Row hover (`surface-sunken`), row selected (`accent-subtle`), row focus
(`focus` ring inside the row), loading (skeleton rows, the header stays),
empty (an [Empty state](empty-state.md) inside the container), error (an
inline error with "Try again").

## Usage

| Do | Don't |
|---|---|
| Right-align numbers, use tabular figures, put the unit in the header | Mix units in one column |
| Left-align text, truncate with an ellipsis and a tooltip | Wrap a cell over three lines |
| Show status with a [Badge](badge.md) | Colour a whole row by status |
| Sort by the column the reader decides by (status, then date) | Default to alphabetical when nobody needs it |

## Content

Header: a noun with the unit in brackets ("Conversion (%)"). Empty cell: an en
dash "–", never "0" when the value is unknown.

## Accessibility

- A real `<table>` with `<th scope="col">`; a caption names the table (visible
  or visually hidden).
- Sortable headers are buttons, and only the column the rows are actually
  sorted by carries `aria-sort`.
- Below `breakpoint-phone` each row becomes a stacked card that repeats the
  header labels.

## Tokens

`surface-raised`, `surface-sunken`, `border`, `accent-subtle`, `text`,
`text-muted`, `focus`, `radius-md`, `space-3`, `space-4`, type `caption`,
`body-sm`, `data`.
