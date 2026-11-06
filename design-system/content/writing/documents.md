---
title: Documents
description: Rules for research briefs, reports, e-mails and slides.
order: 32
---

# Documents

Templates: [document](../templates/document/research-brief.md),
[presentation](../templates/presentation/experiment-review.md),
[e-mail](../templates/email/experiment-update.md).

## Structure

Research and experiment outputs follow the Organization's default structure:

1. **Mechanism**: what demonstrably earns money, in two sentences.
2. **Evidence**: figures with their source and date of verification.
3. **Risks**: legal, platform, money, reputation, each with a guardrail.
4. **Smallest test**: hypothesis, metric, budget, stop condition, owner.
5. **Recommended decision**: one of stop, test, scale, with the reason.

Put the recommendation in the first paragraph too. The reader should be able
to stop after it.

## Rules

- **Title says the conclusion** when there is one: "Price comparison pages: a
  verified signal on mobile", not "Research report".
- **Every figure has a source and a date.** Market claims age quickly.
- **Hypothesis and evidence never mix in one sentence.** Mark each:
  "Hypothesis: …", "Verified signal: …".
- **Tables for comparisons**, prose for reasoning. A table has a caption.
- **Headings in sentence case**, numbered only in documents longer than three
  pages.
- **Footer**: the Organization's name, the document status (Draft or
  Published), the date and the owner.

## Formatting for any medium

| Element | Style token |
|---|---|
| Title | `h1` (`display` on a cover page or title slide) |
| Section | `h2` |
| Body | `body`, 60–80 characters a line |
| Table text | `body-sm`, figures `data` |
| Caption, footer | `caption`, `text-muted` |

Colours: text `text`, secondary `text-muted`, one `accent` for links or the key
figure, status roles only for status. See
[`../brand/colors/palette.md`](../brand/colors/palette.md).
