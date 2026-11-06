---
title: Components
description: The basic set of interface components with states, usage and accessibility.
order: 10
---

# Components

The basic set every interface of the Organization is built from. Each page
has the same sections, so an agent can find the answer in the same place:

1. **Purpose**: what the component is for, and what it is not for.
2. **Anatomy**: its parts.
3. **Variants**: the allowed kinds.
4. **States**: default, hover, focus, active, disabled, loading, error, as far
   as they apply.
5. **Usage**: do and don't.
6. **Content**: how its text is written.
7. **Accessibility**: keyboard, screen reader and contrast requirements.
8. **Tokens**: the roles and scales it uses.

| Component | File |
|---|---|
| Button | [`button.md`](button.md) |
| Input | [`input.md`](input.md) |
| Card | [`card.md`](card.md) |
| Table | [`table.md`](table.md) |
| Dialog | [`dialog.md`](dialog.md) |
| Toast | [`toast.md`](toast.md) |
| Badge | [`badge.md`](badge.md) |
| Empty state | [`empty-state.md`](empty-state.md) |

The viewer's **Gallery** renders every component in its states, in both
themes; its implementation in `app/v1/src/components/ui/` is a reference, not
a published package. A production App builds its own components from the same
tokens and these rules.
