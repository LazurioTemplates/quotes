---
title: "Irreversible actions: Draft and Publish"
description: Nothing that others will see or that can't be undone happens without "Publish".
order: 25
---

# Irreversible actions: Draft and Publish

Example screen: [Stop or scale decision](../examples/screens/stop-or-scale.md).

## The rule

**Nothing irreversible happens without "Publish".** Work is prepared as a
**Draft** that the person can read, change and throw away. It becomes visible
to others, or permanent, only when the responsible person publishes it.

This is the same rule the Organization's agents follow: an agent prepares the
e-mail, the post, the decision or the pull request as a draft, and sends,
posts, merges or pays only after the person says "Publish" for that draft.
Preparing a draft is never publishing.

## What counts as irreversible

- sending anything to people outside the current conversation (e-mail,
  message, invitation, calendar event);
- publishing (a post, a page, a decision, a merge);
- spending money or committing a budget;
- deleting, stopping or overwriting something others rely on.

## The flow

1. **Draft.** The interface shows a `Draft` [badge](../components/badge.md)
   and "Save draft". Nothing leaves the place.
2. **Review.** A summary shows exactly what will happen: to whom, what, how
   much, and whether it can be undone.
3. **Publish.** The primary button says **Publish** (or the specific outcome:
   "Publish and send"). For high-impact actions a
   [destructive confirm dialog](../components/dialog.md) repeats the
   consequences with numbers.
4. **Result.** A [toast](../components/toast.md) states what happened. If an
   undo exists, it is offered; a published action never offers a fake undo.

## Rules

| Do | Don't |
|---|---|
| "Publish" as the only verb for making something visible or permanent | "OK", "Submit", "Continue" for an irreversible step |
| List the recipients and the count in the confirmation | "This may affect some people" |
| Keep the draft after a failed publish | Lose the draft on error |
| Disable double submission while publishing | Let two clicks send twice |
