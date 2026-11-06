---
title: Card
description: Groups related information about one thing.
order: 13
---

# Card

## Purpose

A card groups the information about **one** thing: one experiment, one
mechanism, one metric. A card is not a layout grid for unrelated content.

## Anatomy

Container (`surface-raised`, a `stroke-hairline` `border`, `radius-lg`,
padding `space-6`),
optional eyebrow (`caption`), title (`h3`), body, optional footer with actions
or metadata.

## Variants

| Variant | Use |
|---|---|
| **Static** | Information only |
| **Interactive** | The whole card opens the thing; hover lifts the border to `border-strong` |
| **Metric** | One figure (`h2`, tabular), its label, its source and date |

## States

Default, hover and focus (interactive only), selected (`accent-subtle`
background, an `accent` left edge of `stroke-edge`).

## Usage

| Do | Don't |
|---|---|
| One primary fact per card, then supporting detail | Nest cards inside cards |
| Show the source and date on every metric card | A metric without its unit |
| Keep actions in the footer | Put a primary button in every card of a grid |

## Content

Title: the name of the thing, not a sentence. Body: two to four lines; longer
content belongs on the detail page.

## Accessibility

- An interactive card is one link (the title) whose click area covers the card;
  other links inside it stay separately focusable.
- Do not convey selection by colour only: the selected card also has a check
  icon or "Selected".

## Tokens

`surface-raised`, `border`, `border-strong`, `accent-subtle`, `accent`,
`text`, `text-muted`, `radius-lg`, `space-6`, type `caption`, `h3`, `body`.
