---
title: Button
description: Starts an action. One primary button per view.
order: 11
---

# Button

## Purpose

A button starts an action: save, publish, open a dialog. Navigation to another
page is a link, not a button.

## Anatomy

Container, label, optional leading icon (`size-icon-md`). Height
`size-control` (`size-control-compact` for compact), padding `space-4`
horizontal, radius `radius-md`.

## Variants

| Variant | Use |
|---|---|
| **Primary** | The one action that moves the work forward. At most one per view. |
| **Secondary** | Every other action next to it. |
| **Ghost** | Low-emphasis actions in toolbars and table rows. |
| **Danger** | An action that destroys or stops something. Always confirmed (see [Irreversible actions](../patterns/irreversible-actions.md)). |

## States

| State | Look |
|---|---|
| Default | As the variant |
| Hover | Primary: `accent-hover`; others: `surface-sunken` background |
| Focus | A `stroke-focus` `focus` ring, offset by `stroke-focus`, never removed |
| Active | Same as hover, `stroke-hairline` lower |
| Disabled | 40 % opacity, no pointer, still readable; explain why nearby |
| Loading | Label stays, a spinner replaces the icon, the button is disabled and keeps its width |

## Usage

| Do | Don't |
|---|---|
| Put the primary button last in a dialog footer (right on desktop) | Put two primary buttons next to each other |
| Name the outcome: "Publish decision" | "OK", "Submit", "Yes" |
| Disable "Publish" until the draft is valid, and say what is missing | Hide the button without explanation |

## Content

A verb, or a verb and an object, in sentence case: "Save draft", "Start
experiment", "Publish". Two to three words.

## Accessibility

- Native `<button>` element; activates with Enter and Space.
- An icon-only button has `aria-label` and a tooltip.
- Loading sets `aria-busy="true"`; the result is announced by a toast.
- Label contrast on `accent` is at least 4.5:1 in both themes (tested).

## Tokens

`accent`, `accent-hover`, `on-accent`, `border-strong`, `surface-sunken`,
`danger`, `focus`, `radius-md`, `space-2`, `space-4`, `size-control`,
`size-control-compact`, `size-icon-md`, `stroke-focus`, type `body` (600).
