---
title: Brand
description: The brand in one paragraph, the wordmark and the visual principles.
order: 2
---

# Brand

## In one paragraph

Example, a fictional Organization, finds online mechanisms that demonstrably
earn money, adapts them legally under its own brand, tests them small and scales
only what has evidence. The brand therefore looks like a **calm instrument
panel**: graphite surfaces that stay out of the way, one **signal blue** for
the action that moves work forward, and a warm **lumen** light that marks the
one place to look right now. Nothing glows for decoration. If something is
lit, it carries information.

## Principles

1. **Evidence first.** Numbers, sources and dates are visible, aligned and
   easy to compare. A claim without evidence is shown as a hypothesis.
2. **One action per view.** Each screen or slide has at most one primary
   action in signal blue. Everything else is secondary.
3. **Light means attention.** Lumen marks focus, a highlight or what changed.
   It never fills large areas and never carries text on its own.
4. **Quiet by default.** Generous spacing, few borders, no gradients, no
   drop shadows beyond the two elevation levels.
5. **Status is a word, not only a colour.** Every coloured status also says
   what it is ("Hypothesis", "Verified signal").

## Wordmark

The wordmark is set in the sans typeface, weight 650, followed by the
**signal dot**: a circle a quarter of the cap height wide, in `accent` on light
and `highlight` on dark backgrounds.

- Short form: **Example** with the signal dot. Use it where the full name does
  not fit (tabs, favicons, slide footers).
- Keep clear space of at least the cap height on every side.
- Never stretch, outline, rotate or recolour the wordmark, and never put it on
  a busy image.

There are no logo files in this repository yet; the viewer draws the wordmark
in CSS. When files exist, they go to `content/brand/logo/` with a sibling
Markdown file naming their source.

## Imagery

- Prefer real product screenshots, charts and diagrams over stock photos.
- Charts use the status roles for status and the accent for the one series that
  matters; every other series is `text-subtle`.
- No people-stock, no money imagery (coins, banknotes, rockets), no
  "get rich" visual metaphors.

## Visual do and don't

| Do | Don't |
|---|---|
| One primary button per view | Two blue buttons side by side |
| Lumen underline on what changed since the last review | Lumen as a background of a whole card |
| A table with aligned figures and the date of verification | A big hero number without its source |
| Status badges with a word | A red or green dot without a label |
| Plain white or graphite surfaces | Gradients, glassmorphism, glow effects |
