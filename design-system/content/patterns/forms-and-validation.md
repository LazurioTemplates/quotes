---
title: Forms and validation
description: Layout of forms, when to validate and how to show errors.
order: 21
---

# Forms and validation

Example screen: [New experiment](../examples/screens/new-experiment.md).

## Layout

- One column, labels above fields, at most `width-form` wide. Related fields (a value
  and its unit) may share a row.
- Fields in the order the person thinks: what, why, how much, until when.
  For an experiment that is **hypothesis → metric → budget → stop condition →
  owner**, the five things every experiment must have.
- Group with an `h4` and `space-8` between groups; no boxes around groups.
- Footer: "Save draft" (secondary) and the primary action (right). On long
  forms the footer is sticky.

## Required and optional

Mark the minority. If most fields are required, mark the optional ones
"(optional)"; otherwise mark the required ones "(required)".

## When to validate

| Moment | What |
|---|---|
| While typing | Nothing, except a character counter near a limit |
| On blur | Format errors of that field ("Enter a number") |
| On submit | Everything, including rules across fields ("The budget exceeds the stop condition") |

## Showing errors

1. Each wrong field gets its error message under it (see [Input](../components/input.md)).
2. On submit with errors, a summary at the top lists them as links to the
   fields, and focus moves to the summary.
3. The data the person entered is never lost.
4. The primary button stays enabled; pressing it shows the errors. A disabled
   button with no explanation is a dead end.

## Saving

A form that takes longer than a minute saves a draft automatically and says so
("Draft saved 10:42"). Submitting a draft is a separate, explicit step; if it
is irreversible, it follows [Irreversible actions](irreversible-actions.md).
