import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import packageJson from "../package.json";
import { lockProblem, parseDesignSystemPin } from "./support/design-system-pin.ts";

// The Module's own test of its design system, which stays after an adoption:
// the public template or the Organization's own package, at a released tag,
// locked by bun.lock, never a copy in the Module.
const APP = resolve(import.meta.dir, "..");
const MODULE_ROOT = resolve(APP, "..", "..");

const COMMIT = "05bc729581bd1aa1060b73fe8e03b3c38a56dcd3";
const peers = `{ "peerDependencies": { "astro": "7.4.5", "react": "19.3.1" }, "optionalPeers": ["astro", "react"] }`;
/** A bun.lock as Bun 1.4.4 writes it for a dependency spec and its locked entry. */
const lockFor = (spec: string, entry: string) =>
  `{\n  "workspaces": {\n    "": {\n      "dependencies": {\n        "design-system": "${spec}",\n      },\n    },\n  },\n  "packages": {\n    "design-system": [${entry}],\n  }\n}\n`;
const templateSpec = "github:LazurioTemplates/design-system#v2.0.0";
const templateLock = lockFor(
  templateSpec,
  `"design-system@github:LazurioTemplates/design-system#23af5a3", ${peers}, "LazurioTemplates-design-system-23af5a3", "sha512-gxn6K7t2+8fiX25t2Lpjn02+GK0z0dUPlBRcj8hsTaR5pCdzHj96RyKbcyW9lC2nh5Ei4J34/37mHcd4hnXXRw=="`,
);
const sshSpec = (org: string, tag = "v1.3.0") =>
  `git+ssh://git@github.com/${org}/design-system.git#${tag}`;
const sshLock = (org: string, commit = COMMIT, tag = "v1.3.0") =>
  lockFor(
    sshSpec(org, tag),
    `"design-system@git+ssh://git@github.com/${org}/design-system.git#${commit}", ${peers}, "${commit}"`,
  );

describe("the design system of the Module", () => {
  test("is a released tag of a supported package, exactly as bun.lock locks it", () => {
    const spec = packageJson.dependencies["design-system"];
    expect(parseDesignSystemPin(spec)).not.toBeNull();
    expect(lockProblem(readFileSync(resolve(APP, "bun.lock"), "utf8"), spec)).toBeNull();
  });

  test("is a dependency, never a copy in the Module", () => {
    expect(existsSync(resolve(MODULE_ROOT, "design-system"))).toBe(false);
    expect(existsSync(resolve(APP, "src", "design-system"))).toBe(false);
  });

  test("the public template's pin and its lock pass", () => {
    expect(parseDesignSystemPin(templateSpec)).toEqual({
      kind: "template",
      owner: "LazurioTemplates",
      tag: "v2.0.0",
    });
    expect(lockProblem(templateLock, templateSpec)).toBeNull();
  });

  test("after an adoption, the Organization's own design system over SSH passes", () => {
    const spec = sshSpec("Example-Org");
    expect(parseDesignSystemPin(spec)).toEqual({
      kind: "organization",
      owner: "Example-Org",
      tag: "v1.3.0",
    });
    expect(lockProblem(sshLock("Example-Org"), spec)).toBeNull();
  });

  test("refuses anything but a released tag", () => {
    for (const spec of [
      "github:LazurioTemplates/design-system#main",
      `github:LazurioTemplates/design-system#${COMMIT}`,
      "github:SomeoneElse/design-system#v2.0.0",
      "git+ssh://git@github.com/Example-Org/design-system.git#main",
      `git+ssh://git@github.com/Example-Org/design-system.git#${COMMIT}`,
      "git+https://github.com/Example-Org/design-system.git#v1.3.0",
      "git+ssh://git@github.com/Example-Org/other-package.git#v1.3.0",
      "file:../design-system",
      "../design-system",
      "2.0.0",
    ]) {
      expect({ spec, pin: parseDesignSystemPin(spec) }).toEqual({ spec, pin: null });
    }
  });

  test("refuses a lock that does not lock exactly the pin", () => {
    const spec = sshSpec("Example-Org");
    // The dependency moved but bun install did not run.
    expect(lockProblem(templateLock, spec)).toContain("does not name the same dependency");
    // Another Organization's package under the same spec.
    expect(lockProblem(sshLock("Other-Org").replace(sshSpec("Other-Org"), spec), spec)).toContain(
      "no locked entry of Example-Org",
    );
    // Two different commits in the entry.
    expect(
      lockProblem(
        sshLock("Example-Org").replace(
          `, "${COMMIT}"]`,
          ', "0000000000000000000000000000000000000000"]',
        ),
        spec,
      ),
    ).toContain("two different commits");
    // The template's entry without its sha512.
    expect(lockProblem(templateLock.replace(/, "sha512-[^"]+"/, ""), templateSpec)).toContain(
      "no locked entry",
    );
  });
});
