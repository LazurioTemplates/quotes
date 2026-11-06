---
title: "Template: experiment review deck"
description: Eight 16:9 slides for the stop or scale review of an experiment.
order: 42
---

# Template: experiment review deck

Eight slides, 16:9 and `width-slide` wide, margins `space-16`. One idea per slide; the
slide title is a full-sentence conclusion. Slide numbers and the footer
"Example · [date] · Draft" in `caption`, `text-muted`.

---

## 1 · Title

**Display:** [Experiment name]: [stop / scale]?
**Subtitle (`body-lg`):** Review of [date range] · Owner [name]
Layout: title bottom left, the signal dot next to the wordmark top left,
`surface` background.

---

## 2 · The question

**Title:** We tested whether [hypothesis in one sentence].
Body: the metric and the stop condition, as two large figures (`h1`, `data`)
with their labels (`caption`).

---

## 3 · The mechanism

**Title:** [Who pays whom for what], through [channel].
A three-step diagram, left to right, outline icons, one `accent` arrow on the
step we tested.

---

## 4 · The result

**Title:** [Metric] reached [value] against a target of [value].
A single chart: our series in `accent`, the target as a dashed `text-subtle`
line, everything else `text-subtle`. Source and date under the chart.

---

## 5 · What the evidence does and doesn't show

**Title:** The signal is [verified / not verified] for [scope].
Two columns: "Verified signal" (`success` badge) and "Still a hypothesis"
(`warning` badge), three bullets each at most.

---

## 6 · Risks

**Title:** [The main risk] is the one to watch.
A table: risk, kind, guardrail. Maximum four rows.

---

## 7 · Decision

**Title:** We recommend to [stop / scale] [the mechanism].
One sentence of reasoning. If scale: the next budget ([amount] EUR) and the new
stop condition. The only `highlight` on the whole deck marks the decision.

---

## 8 · Next steps

**Title:** Next: [the first step] by [date].
A numbered list of up to three steps, each with an owner and a date.
