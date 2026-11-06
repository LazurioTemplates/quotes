---
title: "Screen: Stop or scale decision"
category: screens
source: app/v1/src/pages/screens/stop-or-scale.astro
date: 2026-10-27
screen: /screens/stop-or-scale/
notes: Draft, review and Publish for a decision that others will see and that cannot be undone.
---

# Screen: Stop or scale decision

The end of an experiment: a decision is prepared as a draft and published.

## What to notice

- The decision is a **Draft** until the owner publishes it.
- The review summary says exactly what publishing does: the experiment stops,
  the budget is released, and the summary goes to four named people.
- The **confirm dialog** is a question ("Publish the stop decision?"), lists
  the consequences with numbers and says that it can't be undone. Its primary
  button is **Publish**.
- "Publish" opens the real modal dialog; its "Publish" shows a live success
  toast that states what happened, with no fake undo, and leaves after
  `motion-toast-dismiss`. Step 3 is a picture of that toast.

Pattern: [Irreversible actions: Draft and Publish](../../patterns/irreversible-actions.md).
