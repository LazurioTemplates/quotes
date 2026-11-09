# Adopting Quotes into an Organization

This is the procedure an agent follows when a person chooses "Přidat do
Organizace" for Quotes in the Lazurio Marketplace, or asks for it in Chat. It
follows LazurioPlatform
[`docs/marketplace.md`](https://github.com/Lazurio/LazurioPlatform/blob/main/docs/marketplace.md)
and the [Module Standard](https://github.com/Lazurio/LazurioPlatform/blob/main/docs/module-standard.md).

The brief names the **release** (tag and full commit, as the Marketplace
registry records them), the **target Organization**, the **start** (`empty`:
the settings and two categories, no price list; `sample`: the fictional
company Example with its price list, customers and quotes) and the
**language** of the start (`cs` or `en`). When the brief does not name the
language, take the person's (the `locale` of the Folder's profile, the
language you speak with them); when it does not name the start, ask.

**Nothing is merged, published, granted, started or sent without the
person's explicit instruction.** The agent prepares pull requests and
requests; every merge, every publish of data and every access change is the
person's Publication. Where the person's rights do not reach, the agent
prepares a request for whoever may do it and goes on with the rest.

## 1. Check rights, name and compatibility

Do all of this live, before showing a plan.

1. **Who acts.** `gh api user --jq .login` is the person's login. Creating an
   Organization's Module needs an active Owner of the Organization:
   `gh api orgs/<Org>/memberships/<login> --jq .role` is `admin`. Otherwise
   prepare a request for an Owner
   (`gh api "orgs/<Org>/members?role=admin" --jq '.[].login'`): an issue in
   the Organization's root repository with the plan below, assigned to them.
2. **The release.** Compare it with the brief:
   `git ls-remote https://github.com/LazurioTemplates/quotes refs/tags/<tag>`
   must point to the recorded commit (for an annotated tag, its peeled `^{}`
   line). A mismatch stops the adoption.
3. **Name collision.** The slug is `quotes`. Look in the Organization's
   `modules.manifest.json` for a slot with that slug or path, and on GitHub for
   `<Org>/quotes` and `<Org>/quotes-data`.
   - Nothing there: go on with the slug `quotes`.
   - The Organization already runs Quotes (an adoption of this template): this
     is not a new adoption. Take the release as an update
     ([`extending.md`](extending.md), "Taking a template release") and tell
     the person.
   - An unrelated Module or repository has the name (an Organization's own
     price list or offers): tell the person what exists and agree another
     slug with them (for example `nabidky`); use it below for the Module and
     its `<slug>-data` repository. Never overwrite or merge into it.
4. **Compatibility.** The Organization's Environments run a LazurioPlatform
   release that knows `start_script` and `build_output` (v0.1.11 or newer);
   Bun 1.4.4 is fetched by Lazurio when missing.

## 2. Show the plan and wait for confirmation

Show the person, in their language and in a few lines:

- the release (version, tag, commit) and that its code runs in the
  Organization's Environments (`bun install`, the tests, the App);
- the two private repositories that will be created: `<Org>/<slug>` and
  `<Org>/<slug>-data`;
- the Teams that get access, chosen from the Organization's real list
  (`gh api orgs/<Org>/teams --jq '.[].slug'`), never guessed;
- the start and its language;
- for the `empty` start: the Organization's details a quote prints (name,
  company ID, VAT ID, address, e-mail, phone, web, bank account). Take them
  from the person or the Organization's own records they point you to, never
  guess them; whatever is missing stays a placeholder, and the App's check
  lets no quote go out until someone fills it in under Nastavení / Settings;
- the pull requests that will wait for them.

Go on only after the person confirms this plan.

## 3. Create the Module and its data repository

From a task worktree of the Organization's root repository:

```bash
lazurio module create <Org>/<slug> --stack vite-react --teams <team,team> --data --dry-run
lazurio module create <Org>/<slug> --stack vite-react --teams <team,team> --data --confirm <plan>
```

This creates the private Module repository with the scaffold, the private data
repository `<slug>-data` on branch `v3` (initialised by `repository-db init`),
and declares both slots in the root worktree. The root's pull request is the
person's to merge.

## 4. Merge the release into the Module

In a worktree of the new Module, on a branch:

```bash
git fetch https://github.com/LazurioTemplates/quotes.git "refs/tags/<tag>"
test "$(git rev-parse 'FETCH_HEAD^{commit}')" = "<commit>"
git merge --allow-unrelated-histories --no-ff --no-commit <commit>
```

The template's tree wins everywhere except the Organization's identity:

| File | Keep from the scaffold | Take from the template |
| --- | --- | --- |
| `lazurio.module.json` | `id`, `company`, `port_leases` | `apps`, `default_app` (both `app/v3/package.json`) |
| `app/v3/package.json` | `lazurio.runtime`: `id`, `company`, `module` | everything else: scripts, exact dependencies, `packageManager`, `title`, `description`, `dev_script`, `start_script`, `build_script`, `build_output`, the listener `app` with health `/healthz`, `preparation` |
| `app/v3/bun.lock`, `biome.json`, `tsconfig.json`, `vite.config.ts`, `src/`, `tests/`, `seed/` | | the template's |
| `.github/workflows/` | | the template's |
| `README.md`, `AGENTS.md` | | the template's; add a section "This Organization's copy" at the end of `AGENTS.md` |
| `.gitignore` | | the template's (it ignores `/db/`) |

Remove what only the scaffold had: `app/v3/index.html`, `app/v3/src/App.tsx`,
`app/v3/src/main.tsx`, `app/v3/src/greeting.ts`, `app/v3/src/greeting.test.ts`,
`app/v3/seed/.gitkeep` and `app/v3/tests/data.test.ts`. Then set the
Organization's identity:

- `app/v3/config/data-repository.json`: the `remote` of `<Org>/<slug>-data`
  exactly as `db/repository-db.yaml` names it, `branch: v3`;
- `app/v3/src/instance/brand.ts`: the Organization's display name;
- `AGENTS.md`, section "This Organization's copy": who reviews, where its data
  lives, its own pricing rules (a usual markup, a minimum margin, who may give
  a discount), so the skills follow them;
- the design system: when the Organization has adopted and released its own
  design system, change the dependency in `app/v3/package.json` to
  `"design-system": "git+ssh://git@github.com/<Org>/design-system.git#v<version>"`
  and run `bun install` (commit `bun.lock`); otherwise keep
  `github:LazurioTemplates/design-system#v2.0.0` and tell the person their
  quotes print in the example brand until they have their own. A private
  design system cannot be installed by the Module's CI yet
  (Lazurio/LazurioPlatform#915): say so in the pull request, and run
  `bun run check` on the Environment;
- keep `LICENSE` and `NOTICE.md`: MIT requires the notices.

Commit the merge, then check that the release stays an ancestor; this is what
lets later releases arrive as ordinary merges:

```bash
git merge-base --is-ancestor <commit> HEAD
cd app/v3 && bun install --frozen-lockfile && bun run check && bun run build
```

Push the branch and open a pull request in the Module. Do not merge it.

## 5. Prepare the data repository

In a worktree of `<Org>/<slug>-data`, on a branch from `v3`:

- copy `templates/data-repo/` of the release: `schemas/`, `scripts/`,
  `.github/`, `.gitignore`, `README.md` and `AGENTS.md`;
- in `repository-db.yaml` keep `app` and `data_repo` as `lazurio module
  create` wrote them and take `schema`, `layout`, `generated_manifest` and
  `validate` from the template;
- copy the start into `data/`: `app/v3/seed/<cs|en>/<empty|sample>/` of the
  release becomes `data/` (`settings/`, `categories/`, `items/`, `customers/`,
  `quotes/`). Its settings name the language (`record.language`), which the
  App speaks while Lazurio does not hand it the person's (LazurioPlatform#909);
- for the `empty` start, put the Organization's details the person gave you
  into `data/settings/settings.yaml` (`record.supplier`) and leave the rest as
  placeholders; the number format, VAT rates, validity and texts can stay as
  they are or follow what the person said;
- run `bun scripts/validate.ts` there and, with the Module's worktree pointing
  `db/` at this branch, `bun run validate:db` in `app/v3` (the rules across
  records); push and open a pull request into `v3`.

## 6. After the person merges

- `lazurio module start <Org>/<slug>`, then open the App by its `runtime.url`
  and check the main path: the price list, a new quote from the price list,
  its totals, the print page, a change of its state, all saved as a draft.
  Publishing that draft is a Publication into the Organization's data: only on
  the person's instruction, otherwise return it in "Koncept a publikování".
- **Last step: access of Teams.** Set or confirm which Teams reach the Module
  and its data the same way as for every Module, in the Organization overview
  (Přehled Organizace) of Lazurio. The Marketplace has no access list of its
  own. Change access only on the person's instruction.

## Handoff

Tell the person, with links: the root pull request (slots), the Module pull
request, the data pull request, what each waits for and who decides it, the
Organization's details still left as placeholders, and any request prepared
for someone with more rights.
