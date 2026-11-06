---
title: Examples
description: Reviewable references across formats, including the rendered example screens.
order: 50
---

# Examples

Reference examples live here. Every serious asset has a sibling Markdown file
with this front matter:

```yaml
---
title: Example title
category: web
source: workspace/website/app
date: 2026-01-01
notes: What to learn from it.
---
```

Categories: `web`, `presentations`, `documents`, `tables`, `merch`, and
`screens` for the example screens of the viewer.

## Example screens

`screens/` describes four screens that the viewer renders from the reference
components and the tokens, in both themes. Each shows one or more patterns on
realistic, fictional data. What leads somewhere works: the App's navigation
between the screens (behind "Menu" on narrow screens), "New experiment", the
search on Experiments, the error summary's links, and Publish → the confirm
dialog → the live toast. Everything else is a picture of a
control: it looks the same but can't be focused or pressed.

| Screen | Shows |
|---|---|
| [Experiments](screens/experiments.md) | Navigation, a data table with status badges and evidence, the one primary action |
| [New experiment](screens/new-experiment.md) | A form with the five required parts of an experiment and validation errors |
| [Stop or scale decision](screens/stop-or-scale.md) | Draft and Publish: the review summary, the confirm dialog and the result toast |
| [Research sources](screens/research-sources.md) | Empty, partial and error states |

Do not store random moodboards here without source and decision context.
