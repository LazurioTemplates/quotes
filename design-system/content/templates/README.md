---
title: Templates
description: Starters for documents, presentations and e-mails.
order: 40
---

# Templates

Starters for repeated formats. Copy the file, replace every `[placeholder]`,
and keep the structure. Each template is tied to the foundations: it names
style tokens, never its own colours or sizes.

| Template | File | Use for |
|---|---|---|
| Research brief | [`document/research-brief.md`](document/research-brief.md) | Any research or experiment write-up, one to five pages |
| Experiment review deck | [`presentation/experiment-review.md`](presentation/experiment-review.md) | The stop or scale review of an experiment, 8 slides |
| Experiment update e-mail | [`email/experiment-update.md`](email/experiment-update.md) and [`email/experiment-update.html`](email/experiment-update.html) | A short update to people outside the experiment |

## How to use a template

1. Copy it into the module that owns the output (`workspace/research/`,
   `workspace/experiments/`), never edit it here for a single use.
2. Replace every `[placeholder]`. A placeholder left in the output is a
   mistake; search for `[` before you hand the draft over.
3. Prices and budgets stay placeholders in examples: `[amount] EUR`.
4. Render with the tokens: [`../brand/colors/tokens.json`](../brand/colors/tokens.json)
   for colours, type and spacing; [`../writing/documents.md`](../writing/documents.md)
   for structure and style.
5. The output is a **Draft** until the responsible person publishes it (see
   [`../patterns/irreversible-actions.md`](../patterns/irreversible-actions.md)).
   Sending the e-mail is publishing.

When a template changes, its examples change in the same pull request.
