---
title: Toast
description: Briefly confirms the result of an action.
order: 16
---

# Toast

## Purpose

A toast confirms the **result of an action the person just took**: saved,
published, failed. It is not for system news or marketing.

## Anatomy

Container (`surface-raised`, overlay shadow, `radius-md`, `width-toast`),
status icon,
message (`body-sm`), optional single action ("Undo", "View"), close button.
Bottom right on desktop, bottom full width on phones.

## Variants

| Variant | Background and icon |
|---|---|
| **Info** | `accent-subtle`, `accent-text` |
| **Success** | `success-subtle`, `success` |
| **Warning** | `warning-subtle`, `warning` |
| **Error** | `danger-subtle`, `danger` |

## States

Success and info disappear after `motion-toast-dismiss`, but stay while
hovered or focused. Warning and error stay until closed. At most three toasts
at once; the oldest leaves first.

## Usage

| Do | Don't |
|---|---|
| Say what happened: "Draft saved." | "Success!" |
| Offer "Undo" when the action is reversible | Offer "Undo" for a published action |
| Put the error *and* the next step: "Not published. The connection dropped. Try again." | Show an error toast for a form field error |

## Content

One sentence, past tense for results ("Decision published."). An action label
of one word.

## Accessibility

- A live region: `role="status"` for info and success, `role="alert"` for
  warning and error.
- Never the only place where an error is shown if the reader must act on it.
- The auto-dismiss timer pauses on hover and focus.
- A toast's controls work: Close closes it, and an action ("Undo", "View",
  "Try again") does what it says. A toast without a real action has none.
- When a toast that holds focus leaves (Close, or pushed out as the fourth),
  focus returns to where it came from, or to the page's main region; it is
  never dropped.
- A picture of a toast in documentation is a figure, not a live region, and
  holds no control.

## Tokens

`surface-raised`, `accent-subtle`, `success-subtle`, `warning-subtle`,
`danger-subtle`, `accent-text`, `success`, `warning`, `danger`, `text`,
`radius-md`, `space-3`, `space-4`, type `body-sm`.
