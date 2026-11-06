---
title: "Screen: Experiments"
category: screens
source: app/v1/src/pages/screens/experiments.astro
date: 2026-10-27
screen: /screens/experiments/
notes: A working list where the reader decides what needs a stop or scale decision first.
---

# Screen: Experiments

The list of all experiments of the Organization.

## What to notice

- **One primary action** ("New experiment") next to the page title.
- **The next decision first**: the caption says the order (due now, then by
  date, then undated and finished), and no column claims a sort it doesn't
  have. Status is a [badge](../../components/badge.md) with a word.
- **Evidence in the row**: every rate has its sample ("3.1 % of 1,240"), the
  date of verification and the path of its experiment log. A rate without them
  would be a hypothesis.
- **Search works**: it filters the rows, the count below the table follows it
  and is announced, and when nothing matches an empty state offers "Clear
  search".
- Below `breakpoint-phone` the rows become stacked blocks that repeat their
  labels, and below `breakpoint-tablet` the App's sections collapse behind
  "Menu".
- **Figures align right** with tabular numerals; unknown values are "–".
- The "New" highlight marks the one row that changed since the last visit.

Patterns: [Navigation](../../patterns/navigation.md),
[Data tables](../../patterns/data-tables.md).
