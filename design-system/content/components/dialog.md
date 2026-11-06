---
title: Dialog
description: Interrupts to confirm a decision or collect a little input.
order: 15
---

# Dialog

## Purpose

A modal dialog interrupts the work to **confirm a decision** or collect a
little input that belongs to the current step. Anything longer than one short
form is a page.

## Anatomy

Backdrop (`scrim` at 60 %), container (`surface-raised`, `radius-lg`,
overlay shadow, `width-dialog`, or `width-dialog-wide` when the body is a
list), title (`h3`), body, footer with actions
(secondary
left, primary right), close button top right.

## Variants

| Variant | Use |
|---|---|
| **Confirm** | A decision with consequences; the primary button names the outcome |
| **Destructive confirm** | Deleting, stopping or publishing something irreversible; the primary button is Danger or "Publish", and the body lists exactly what happens |
| **Form** | Up to four fields |

## States

Opening and closing animate opacity only (`motion-fast`; none when the reader
prefers
reduced motion). While the action runs, the primary button shows loading and
the dialog cannot be dismissed.

## Usage

| Do | Don't |
|---|---|
| Title as a question: "Publish the stop decision?" | "Are you sure?" |
| List the consequences in the body, with numbers | Repeat the title in the body |
| Keep focus inside the dialog until it closes | Open a dialog from a dialog |

## Content

Title: the decision as a question. Body: what will happen, to whom, and whether
it can be undone. Buttons: "Cancel" and the outcome ("Publish", "Delete
draft").

## Accessibility

- The native `<dialog>` opened with `showModal()`, `aria-labelledby` the
  title: the browser announces it as modal and makes the rest of the page
  inert, so focus stays inside.
- Focus starts on the least destructive action (`autofocus` on "Cancel" for a
  destructive confirm) and returns to the trigger on close; the trigger has
  `aria-haspopup="dialog"`.
- Escape closes, except while the action runs.
- A picture of a dialog in documentation or a gallery is not a dialog: it is
  shown inline in a `<figure>` with a caption, without the dialog role.

## Tokens

`surface-raised`, `scrim`, `text`, `text-muted`, `border`, `danger`,
`accent`, `focus`, `radius-lg`, `space-6`, `width-dialog`,
`width-dialog-wide`, `motion-fast`, type `h3`, `body`.
