---
title: "Screen: New experiment"
category: screens
source: app/v1/src/pages/screens/new-experiment.astro
date: 2026-10-27
screen: /screens/new-experiment/
notes: The form forces the five parts every experiment needs and shows errors the recommended way.
---

# Screen: New experiment

The form that turns a hypothesis from research into an experiment.

## What to notice

- The fields follow the method: **hypothesis → metric → budget → stop
  condition → owner**. All five are required, so none is marked; the one
  optional field says "(optional)".
- The screen shows the state **after a submit with errors**: an error summary
  at the top links to the fields, each wrong field has its message under it,
  and nothing the person typed is lost.
- "Save draft" stays available; "Start experiment" is the primary action.
- The budget is a placeholder in square brackets, as everywhere in examples.

Pattern: [Forms and validation](../../patterns/forms-and-validation.md).
