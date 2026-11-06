---
title: Navigation
description: Where things are and how a person moves between them.
order: 23
---

# Navigation

## Structure

- **Sidebar**, `width-sidebar` wide, for the sections of an App (5–7 items,
  icon + label). The active
  item uses `accent-text` and an `accent` edge of `stroke-edge`.
- **Header**, `size-header` high, with the wordmark, the current Organization and the person's menu.
- **Page title** (`h1`) repeats the name of the active item, plus at most one
  primary action to its right.
- **Tabs** for views of the same thing (an experiment's Plan, Log, Result);
  never for unrelated pages.
- **Breadcrumbs** only from the third level down.

## Rules

| Do | Don't |
|---|---|
| Same order of sections in every App of the Organization | Reorder by usage |
| Names that are nouns: "Experiments", "Research", "Playbooks" | Verbs or slogans: "Get insights" |
| Keep the URL meaningful and shareable | Open a page in a dialog |
| Collapse the sidebar to a menu button below `breakpoint-tablet` | Hide sections behind "More" on desktop |

## Accessibility

- A `<nav>` landmark with an `aria-label`; the active item has
  `aria-current="page"`.
- A "Skip to content" link is the first focusable element.
- Tabs use the ARIA tabs pattern (arrow keys move between tabs).
