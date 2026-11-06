---
title: Empty and error states
description: What a place shows when it has nothing, is loading or failed.
order: 22
---

# Empty and error states

Example screen: [Research sources](../examples/screens/research-sources.md).

Every place that shows data has four states, and each is designed:

| State | Shows |
|---|---|
| **Loading** | Skeletons in the shape of the content, after `motion-loading-delay`; never a blank area |
| **Empty** | An [Empty state](../components/empty-state.md) with one next step |
| **Partial** | The data that arrived, plus an inline warning about what didn't |
| **Error** | What failed, why if known, and what to do |

## Error messages

Three parts, in this order:

1. **What happened**, in plain words: "The source could not be read."
2. **Why**, if it helps the person: "The page asked for a sign-in."
3. **What to do**: "Open it in the browser and add the figures by hand, or
   try again later."

Never show a stack trace, an internal code alone or "Something went wrong".
A code may follow the message for support ("Code: source-auth-required").

## Where errors appear

| Scope | Component |
|---|---|
| One field | Message under the [Input](../components/input.md) |
| One block (a card, a table) | Inline error inside the block with "Try again" |
| The whole page | A page-level error with the navigation still working |
| The result of an action | An error [Toast](../components/toast.md) that stays until closed |

## Unknown is not zero

When a value could not be read, show "–" with "not verified" and the reason,
never "0" or "not connected". An agent that reads such a page must report the
value as unknown and must not fall back to a different, unofficial source.
