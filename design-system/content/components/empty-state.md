---
title: Empty state
description: Explains why a place is empty and what to do next.
order: 18
---

# Empty state

## Purpose

An empty state explains **why** a place has no content and offers **one next
step**. It replaces the content area; the surrounding page stays.

## Anatomy

At most `width-empty-state` wide, centred in the place it replaces.

Icon (`size-icon-lg` inside a card, `size-icon-xl` for a page,
`text-subtle`), title (`h4`),
one sentence (`body-sm`, `text-muted`), one action (primary for a first use,
secondary otherwise).

## Variants

| Variant | Example |
|---|---|
| **First use** | "No experiments yet. Start one from a mechanism in research." |
| **No results** | "No experiments match 'pricing'. Clear the filter." |
| **Done** | "Every source is verified. Nothing waits for review." |

For errors, see [Empty and error states](../patterns/empty-and-error-states.md).

## States

Static. The action follows the Button states.

## Usage

| Do | Don't |
|---|---|
| Say what would be here and how it gets here | "Nothing here" |
| Offer the one action that fills the place | An illustration that pushes the action below the fold |
| For "no results", show the active filter and how to clear it | Blame the person ("You have no…") |

## Content

Title: what is missing ("No experiments yet"). Sentence: how it gets filled.
Action: the verb ("Start experiment").

## Accessibility

- The icon is decorative (`aria-hidden="true"`).
- After a search empties a table, announce the result count in a live region.

## Tokens

`text`, `text-muted`, `text-subtle`, `space-2`, `space-4`, `space-8`, type
`h4`, `body-sm`.
