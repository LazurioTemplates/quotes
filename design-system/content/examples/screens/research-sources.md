---
title: "Screen: Research sources"
category: screens
source: app/v1/src/pages/screens/research-sources.astro
date: 2026-10-27
screen: /screens/research-sources/
notes: Every data place has designed empty, partial and error states; unknown is never zero.
---

# Screen: Research sources

The sources behind one mechanism's research.

## What to notice

- **Partial**: two sources were read, one could not be. Its figures show "–"
  and "not verified" with the reason, never "0".
- **Error** inside one block, with "Try again", while the rest of the page
  works.
- **Empty**: the "Competitor pricing" group has no sources yet; the empty state
  says how to add one and offers that single action.

Pattern: [Empty and error states](../../patterns/empty-and-error-states.md).
