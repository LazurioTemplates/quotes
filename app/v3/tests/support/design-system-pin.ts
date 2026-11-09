/**
 * The two ways a Module may depend on its design system (LazurioTemplates/
 * design-system, docs/adoption.md "Adding it to a module"), always at a
 * released tag:
 *
 * - the public template: `github:LazurioTemplates/design-system#v<semver>`,
 *   which `bun.lock` records with the tag's commit and the archive's `sha512`;
 * - the Organization's own: `git+ssh://git@github.com/<Org>/design-system.git#v<semver>`,
 *   which `bun.lock` records with the full commit.
 *
 * Never a branch, a bare commit, `file:` or a path.
 */
export type DesignSystemPin =
  | { kind: "template"; owner: "LazurioTemplates"; tag: string }
  | { kind: "organization"; owner: string; tag: string };

const OWNER = "[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?";
const TAG = "v\\d+\\.\\d+\\.\\d+";
const TEMPLATE_PIN = new RegExp(`^github:LazurioTemplates/design-system#(${TAG})$`);
const ORGANIZATION_PIN = new RegExp(
  `^git\\+ssh://git@github\\.com/(${OWNER})/design-system\\.git#(${TAG})$`,
);

export function parseDesignSystemPin(spec: string): DesignSystemPin | null {
  const template = TEMPLATE_PIN.exec(spec);
  if (template?.[1]) return { kind: "template", owner: "LazurioTemplates", tag: template[1] };
  const organization = ORGANIZATION_PIN.exec(spec);
  if (organization?.[1] && organization[2]) {
    return { kind: "organization", owner: organization[1], tag: organization[2] };
  }
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

/**
 * Why `bun.lock` does not lock exactly the dependency `spec`, or null when it
 * does: the workspace names the same spec, and the package entry resolves
 * the same repository to a commit (for the template, also an `sha512`).
 */
export function lockProblem(lock: string, spec: string): string | null {
  const pin = parseDesignSystemPin(spec);
  if (!pin) return `"${spec}" is not a released tag of a supported design system`;
  if (!lock.includes(`"design-system": "${spec}"`)) {
    return "bun.lock does not name the same dependency; run bun install";
  }
  const entry =
    pin.kind === "template"
      ? /"design-system": \["design-system@github:LazurioTemplates\/design-system#[0-9a-f]{7,40}",[^\n]*"sha512-[A-Za-z0-9+/=]+"\]/
      : new RegExp(
          `"design-system": \\["design-system@git\\+ssh://git@github\\.com/${escapeRegExp(pin.owner)}/design-system\\.git#([0-9a-f]{40})",[^\\n]*"([0-9a-f]{40})"\\]`,
        );
  const match = entry.exec(lock);
  if (!match) return `bun.lock has no locked entry of ${pin.owner}/design-system`;
  if (pin.kind === "organization" && match[1] !== match[2]) {
    return "bun.lock names two different commits of the design system";
  }
  return null;
}
