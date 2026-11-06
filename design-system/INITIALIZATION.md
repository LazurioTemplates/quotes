# Design system initialization

Use this checklist when you set up the design system or refresh it
substantially.

## 1. Find the source of truth

Go through these, where they exist:

- `workspace/website/README.md`
- `workspace/website/ARCHITECTURE.md`
- `workspace/website/AGENTS.md`
- production CSS and theme tokens in the website App
- brand, strategy or service documents in `workspace/knowledgebase/`
- `company/agents/voice/` in the Organization root
- existing presentations, offers, datasheets and documents

## 2. Extract the baseline

Write into `BASELINE.md`:

- the canonical name and the public brand name
- the tone-of-voice source
- primary colours
- typography
- layout principles
- forbidden claims and forbidden visual directions
- where the production surfaces should be updated

## 3. Fill `content/`

Minimum first commit:

- `content/brand/colors/tokens.json`
- `content/brand/colors/palette.md`
- `content/brand/typography/typography.md`
- `content/examples/README.md`
- `content/templates/README.md`

## 4. Check the viewer

```bash
cd app/v1
bun install --frozen-lockfile
bun run build
```

Then open the viewer through Lazurio, with `lazurio module start
<Organization>/design-system` or from the Launchpad. The App reads
its host and port only from the listener that Lazurio assigns from the `main`
lease in `lazurio.module.json`, never from a `.env` file, and refuses to start
without it.

## 5. Record drift

When you find a disagreement between production and the design system:

1. production stays the truth
2. fix the design system
3. if production is clearly out of date, record an open follow-up as an issue
   in the owning repository
