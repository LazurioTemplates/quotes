---
title: Spacing, sizes and layout
description: Spacing, radius, sizes, strokes, layout widths, breakpoints and motion.
order: 6
---

# Spacing, sizes and layout

Source of truth for the values: `space`, `radius`, `size`, `stroke`,
`width`, `breakpoint` and `motion` in
[`../colors/tokens.json`](../colors/tokens.json). This page names the tokens;
the viewer's **Tokens** page shows their values.

## Spacing

Everything sits on a grid of `space-1`. Use the named steps only:

| Step | Use |
|---|---|
| `space-1` | Between an icon and its label |
| `space-2` | Inside compact controls, between a label and its input |
| `space-3` | Inside badges and table cells, vertical |
| `space-4` | Inside buttons and inputs, between fields of a form |
| `space-6` | Inside cards and dialogs |
| `space-8` | Between sections of a page |
| `space-12`, `space-16` | Around a page title, between major regions, slide margins |

Rule of proximity: things that belong together are closer to each other than
to anything else. If a label is equally far from two inputs, the spacing is
wrong.

## Radius

| Token | Use |
|---|---|
| `radius-sm` | Badges, checkboxes, inline code |
| `radius-md` | Buttons, inputs, toasts, table containers |
| `radius-lg` | Cards and dialogs |
| `radius-pill` | Avatars and the signal dot only |

Nested corners: an element inside a rounded container uses a smaller radius
than the container.

## Sizes and strokes

| Token | Use |
|---|---|
| `size-header` | The height of an App's header |
| `size-control` | The height of buttons, inputs and selects |
| `size-control-compact` | Compact buttons, icon buttons, filter chips |
| `size-row`, `size-row-compact` | Table rows, default and compact |
| `size-icon-sm` … `size-icon-xl` | Icons (see [iconography](../iconography/iconography.md)) |
| `stroke-hairline` | Borders and dividers |
| `stroke-focus` | The focus ring and its offset |
| `stroke-edge` | The accent edge of a selected item |
| `stroke-icon` | The line of outline icons |

## Elevation

Two levels only:

1. **Raised**: `surface-raised` with a `border`. Cards, tables, inputs.
2. **Overlay**: `surface-raised` with a soft shadow of the `scrim` role.
   Dialogs, toasts, menus.

## Layout widths

| Surface | Width |
|---|---|
| An App's sidebar | `width-sidebar` |
| A form | at most `width-form` |
| Reading (documents, settings) | at most `width-reading` of content |
| Working (tables, dashboards) | at most `width-working`, full width below |
| Dialog | `width-dialog`, or `width-dialog-wide` for a dialog with a list |
| Toast | `width-toast` |
| Empty state | at most `width-empty-state` |
| Slide | 16:9, `width-slide` wide, margins `space-16` |

Breakpoints: `breakpoint-phone`, `breakpoint-tablet` and `breakpoint-desktop`.
Below `breakpoint-tablet` navigation collapses into a menu; below
`breakpoint-phone` tables become stacked rows (see
[`../../patterns/data-tables.md`](../../patterns/data-tables.md)).

## Motion

| Token | Use |
|---|---|
| `motion-fast` | Opening and closing overlays (opacity only) |
| `motion-loading-delay` | How long to wait before showing a loading skeleton |
| `motion-spin` | One turn of a busy spinner |
| `motion-toast-dismiss` | How long a success or info toast stays (paused while hovered or focused) |

When the reader prefers reduced motion, nothing animates.
