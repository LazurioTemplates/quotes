---
title: Badge
description: Labels the status or category of an item with a word.
order: 17
---

# Badge

## Purpose

A badge labels the **status or category** of an item in a table, a card or a
heading. It is not a button and not a counter of notifications.

## Anatomy

Container (`radius-sm`, padding `space-1` vertical, `space-2` horizontal),
optional `size-icon-sm` icon, label (`caption`).

## Variants

The statuses of the method, each with a fixed role:

| Badge | Role | Meaning |
|---|---|---|
| **Hypothesis** | `warning` on `warning-subtle` | No evidence yet |
| **Running** | `accent-text` on `accent-subtle` | An experiment collects data |
| **Verified signal** | `success` on `success-subtle` | Real evidence meets the metric |
| **Stopped** | `danger` on `danger-subtle` | The stop condition was reached |
| **Scaling** | `on-accent` on `accent` | A verified mechanism is scaled |
| **Draft** | `text-muted` on `surface-sunken` | Not published yet |
| **New** | `on-highlight` on `highlight` | Changed since the reader's last visit |

## States

Static. A badge never has hover or focus of its own.

## Usage

| Do | Don't |
|---|---|
| One badge per item for its status | Three badges in a row |
| Keep the exact words above everywhere | "Validated", "Proven", "Confirmed" for the same status |
| Put the badge after the name it describes | Use a badge as a button |

## Content

One or two words, sentence case. The words are the terminology of
[`../writing/terminology.md`](../writing/terminology.md).

## Accessibility

- The status is in the text, so colour is never the only signal.
- In a table, the column header names what the badge means ("Status").

## Tokens

The status roles above, `radius-sm`, `space-1`, `space-2`, type `caption`.
