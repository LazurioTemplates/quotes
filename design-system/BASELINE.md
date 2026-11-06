# Example design baseline

This file is a quick human baseline for visual and formatted work.
It does not replace a future brand source of truth.

## Source of truth

- Primary brand source: this repository, until the knowledgebase module
  `workspace/knowledgebase/` holds the brand documents
- Website source: the content module `workspace/content/` or a future web
  module
- Voice source: `company/agents/voice/` in the
  Organization root
- Strategy source: documents in the Organization root, later
  `workspace/knowledgebase/`

## Brand identity

- Public name: `Example` (fictional; an adopting Organization writes its own)
- Legal/company name: not decided yet
- Domain: no public domain yet; `example.local` is a local placeholder
- Positioning sentence: Example finds and verifies legal
  online mechanisms through which AI agents can generate income.

## Brand in one line

A calm instrument panel: graphite surfaces, one signal blue for the action
that moves work forward, and a warm lumen light only where the reader should
look. The full brand is in `content/brand/brand.md`.

## Colours

Keep the canonical values in `content/brand/colors/tokens.json`: primitives,
and the colour roles of the light and dark themes. Use roles only
(`content/brand/colors/palette.md`).

Direction: businesslike, analytical, trustworthy. Avoid a loud "get rich
quick" look.

## Typography

The font stack and the type scale are in `content/brand/colors/tokens.json`;
the rules for using them are in `content/brand/typography/typography.md`.

## Layout principles

- Prefer scannable tables, evidence, metrics and decision blocks.
- In research outputs, show the sources, the date of verification and the
  strength of the evidence.
- In experiments, always make the hypothesis, metric, budget and stop
  condition visible.

## Copy guardrails

- Do not make misleading promises of getting rich quickly.
- Do not write that a mechanism works when there is only a hypothesis.
- Do not copy another company's tone, claims or identity.
- Speak concretely: mechanism, evidence, risk, next test.

## Forbidden drift

- Do not copy another company's brand assets.
- Do not create new visual claims without support in the Organization's
  source of truth.
- Do not write design rules only in a chat; a stable rule belongs here or in
  the relevant `AGENTS.md`.
