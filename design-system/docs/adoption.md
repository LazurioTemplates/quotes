# Adopting the design system into another Organization

This guide is for the agent that adopts this template for a person, usually
after "Přidat do Organizace" in the Marketplace of Lazurio handed it a brief
with the exact release, the target Organization and how the module starts.
Adoption is an agent's reviewed work in pull requests, not an installer. The
person decides; the agent prepares.

The result is a private module of the target Organization whose history
contains the release's commit as an ancestor, with the target's identity
(name, lease, Teams) and, unless the person chose the example, the target's
own brand. Later releases of the template reach it as ordinary merges (see
[Taking an update](extending.md#taking-an-update-of-the-template)).

## What you need before you start

- The **release**: its tag `v<version>` and the full commit the tag points to,
  both from the brief or the Marketplace registry. A tag alone is not an
  immutable identity: fetch the tag and confirm that it resolves to that
  commit. If it does not, stop and report it.
- The **target Organization**, as the person named it. Never pick another one
  or a personal account instead.
- The **start**: `sample` keeps the fictional example brand to explore it;
  `empty` replaces it with the Organization's own brand (step 7). When the
  brief does not say, ask.

## 1. Read the target's rules

Open the target Organization's root checkout and read its `AGENTS.md`, its
`lazurio.organization.json` and the nearest rules for modules. They apply
inside its checkout and win over this guide where they are stricter (language,
branch names, review). Work in a task worktree of the Organization root, never
in its primary checkout.

## 2. Check live rights

Rights come from GitHub now, not from a checkout:

```sh
gh api user --jq .login
gh api orgs/<Organization>/memberships/<login> --jq '.role,.state'   # admin, active
gh api repos/LazurioTemplates/design-system --jq .visibility   # public
```

`lazurio module create` for an Organization is run by an active Owner (admin)
of that Organization. When the person is not one, do not look for another
way: prepare the plan and a short request for an Owner (who and what to run),
record it as an issue in the Organization's root repository, give the person
its URL and stop there.

## 3. Check the name

The template's module id is `design-system`. Look for a collision, letter case
ignored, before you propose the name:

- a slot or directory `design-system` in the target's `modules.manifest.json`,
  `workspace/` or the root (Organizations often keep their design system as a
  root-level module, `design-system/`);
- a repository `<Organization>/design-system` on GitHub
  (`gh api repos/<Organization>/design-system`).

When the name is taken, do not reuse or overwrite anything. Tell the person
what exists and agree on another slug with them, for example
`design-system-example` for a trial beside an existing design system. If the
existing module is already an adoption of this template, this is an update,
not an adoption: follow [Taking an update](extending.md#taking-an-update-of-the-template)
in that module instead.

## 4. Check compatibility

- Lazurio on the Environment runs Apps declared with `lazurio.runtime.v1` and
  `lazurio.preparation.v1` and fetches the Bun the App pins (`packageManager`,
  `bun@1.4.4` in this release). `lazurio module list <Organization> --json`
  must list the Organization's modules.
- The App is static (`build_output: "dist"`) and declares no secrets and no
  siblings, so it needs nothing from the target besides a port of its pool.

## 5. Show the plan, then create the module

Run the generator as a dry run and show the person the plan together with
what follows from it (the private repository, the Teams that get Write, the
port, the release you will merge):

```sh
lazurio module create <Organization>/<slug> --stack astro --teams <team,team> --dry-run --json
```

Teams come from the Organization's real list; ask the person which ones, and
never invent one. Only after the person confirms the plan, run it with
`--confirm <plan>` from the task worktree of the Organization root. The run
creates the private repository, places the module in `workspace/<slug>`,
pushes `main` and declares the slot in the worktree's `modules.manifest.json`.
Commit that and open the root's pull request; merging it is the person's
Publication.

## 6. Merge the release so it stays an ancestor

In a task worktree of the new module (`git worktree add`, a branch of its own):

```sh
git remote add template https://github.com/LazurioTemplates/design-system.git
git fetch template tag v<version>
test "$(git rev-parse 'v<version>^{commit}')" = "<commit from the brief>"
git merge --allow-unrelated-histories --no-ff -m "Design system: adopt template release v<version>" <commit>
```

Never squash, rebase or copy the files instead: the merge keeps the release as
an ancestor, and that is what lets a later release merge cleanly. Resolve the
files the scaffold and the template both have like this:

| File | Keep from the scaffold | Take from the template |
| --- | --- | --- |
| `lazurio.module.json` | `id`, `company`, `port_leases` | `apps`, `default_app` (both `app/v1/package.json`) |
| `app/v1/package.json` | `lazurio.runtime`: `id`, `title`, `company`, `module` | everything else: `name`, `version`, scripts, exact dependencies, `packageManager`, `build_*`, `static_fallback`, `tags`, the listener, `preparation` |
| `app/v1/bun.lock` | | the template's; `bun install --frozen-lockfile` confirms it is current |
| `app/v1/astro.config.ts`, `tsconfig.json`, `biome.json`, `src/`, `tests/` | | the template's |
| `README.md`, `AGENTS.md` | | the template's, then adapt them (step 7) |
| `.github/workflows/check.yml` | | the template's |
| `.github/CODEOWNERS` | the target's Team, or no file when the Organization does not use one | |

Delete what only the scaffold had (its starter page and its test) when the
template has no counterpart.

## 7. Make it the Organization's own

The fictional brand lives in a handful of places. With the `sample` start,
keep it and do only the identity part; with `empty`, do both.

**Identity** (always):

- `app/v1/src/lib/routes.ts`: `REPOSITORY` is the new repository's URL; the
  viewer links every page to its source there.
- `README.md` and `AGENTS.md`: the Organization's name, and one line saying
  that the module was adopted from `LazurioTemplates/design-system`
  at `v<version>` (`<commit>`). Keep `LICENSE` and `NOTICE`; they are the
  template's license and attribution, which MIT requires to stay with the
  copy. Add a copyright line of your own to `NOTICE` for your changes if you
  want one.

**Brand** (the `empty` start, or whenever the Organization is ready):

1. Follow [`INITIALIZATION.md`](../INITIALIZATION.md): find the
   Organization's production sources of truth first (website, brand brief,
   voice guide). The design system mirrors them and never invents a brand.
2. Replace the values in `content/brand/colors/tokens.json` (name, palette,
   theme roles, type, spacing) and keep its shape. The tests check the shape
   and that every role pair the components use reaches WCAG AA contrast in
   both themes, so a palette that fails contrast fails `bun run check`.
3. Rewrite `BASELINE.md` and `content/brand/` (brand, voice and tone, palette,
   typography, iconography) for the Organization.
4. Replace the wordmark text in `app/v1/src/layouts/Viewer.astro` and
   `AppFrame.astro`, the Organization name in `AppFrame.astro` and
   `app/v1/src/pages/index.astro`, and the fictional company in
   `content/templates/` and `content/writing/terminology.md`.
5. The example screens (`content/examples/screens/`,
   `app/v1/src/pages/screens/`) show a fictional product. Replace them with
   screens of the Organization's own Apps, or delete them together with their
   pages and the routes the tests expect (`tests/content.test.ts`,
   `tests/build.test.ts`).

Never copy another company's brand, logos or content into the module, and
never real customer data into an example.

## 8. Verify

In the module's task worktree:

```sh
cd app/v1
bun install --frozen-lockfile
bun run check      # astro check, Biome and every test, the build included
git merge-base --is-ancestor <commit> HEAD && echo ancestor
```

Open the module's pull request with what you did, what you verified, the
merged release and commit, and what is left. After both pull requests are
merged and the module is checked out on `main`, `lazurio module setup` must
report it `current`, and `lazurio module start <Organization>/<slug> --json`
returns the URL to open. A preview before the merge is not proof that the
module runs in the Organization.

## 9. Access for Teams, last

Who may open the module follows the Organization's manifest and live GitHub
grants, set the same way as for every other module of the Organization. The
Marketplace grants nothing and keeps no list of its own. Change access only
as the last step and only on the person's instruction.

## What you never do

- merge, tag, publish, change a repository's visibility or start anything for
  others without the person's explicit instruction;
- force-push, delete a branch, repository or data, or reset a protected
  branch; a failed or partial adoption keeps its worktree and tells the person
  exactly where to resume;
- read files of this template repository at run time: the module is a copy
  that takes updates by merge.
