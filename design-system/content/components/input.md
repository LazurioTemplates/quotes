---
title: Input
description: Lets a person enter a short value, with a label, a hint and an error.
order: 12
---

# Input

## Purpose

A single-line text, number, date or select field. Multi-line text uses the
same rules in a textarea.

## Anatomy

Label (above), field, optional hint (below), error message (below, replaces the
hint), optional unit or prefix inside the field.

## Variants

Text, number (right-aligned, with a unit), date, select, textarea. Read-only
fields use `surface-sunken` and no border.

## States

| State | Look |
|---|---|
| Default | `surface-raised`, a `stroke-hairline` `border-strong` border |
| Hover | Border `text-subtle` |
| Focus | A `stroke-focus` `focus` ring |
| Filled | Same as default; the value is `text` |
| Error | Border `danger`, message in `danger` with the error icon |
| Disabled | `surface-sunken`, `text-subtle`, no ring |

## Usage

| Do | Don't |
|---|---|
| Always show a visible label above the field | Use the placeholder as the label |
| Say the format in the hint: "In EUR per week" | Validate on every keystroke |
| Validate on blur and on submit (see [Forms and validation](../patterns/forms-and-validation.md)) | Clear the field after an error |

## Content

Label: a noun in sentence case, no colon ("Weekly budget"). Hint: one short
sentence. Error: what is wrong and how to fix it ("Enter a stop condition, for
example a date or a metric threshold.").

## Accessibility

- `<label for>` linked to the field; hint and error linked by
  `aria-describedby`.
- Error sets `aria-invalid="true"`; on submit, focus moves to the first field
  with an error.
- Required fields say "Required" in the label, not only with an asterisk.

## Tokens

`surface-raised`, `surface-sunken`, `border-strong`, `text`, `text-muted`,
`text-subtle`, `danger`, `focus`, `radius-md`, `space-2`, `space-4`,
`size-control`, `stroke-hairline`, `stroke-focus`, type `body` and `body-sm`.
