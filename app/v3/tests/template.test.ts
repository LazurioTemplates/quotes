import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import packageJson from "../package.json";
import { parseDesignSystemPin } from "./support/design-system-pin.ts";

// The contract of the Module, checked on every pull request: the license and
// the documents, exact versions, the built version to run from `main`, the
// skills and paths that check out on Windows. The part only the template
// keeps (its placeholder identity, its own pins, its release notes and the
// Marketplace screenshots) runs only while the identity is the template's
// and is skipped in an adopted Module.
const ROOT = resolve(import.meta.dir, "..", "..", "..");
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");
const TEMPLATE = JSON.parse(read("lazurio.module.json")).company === "REPLACE-WITH-ORG-NAME";

describe("module contract", () => {
  test("MIT by Lazurio contributors, with the documents an adoption needs", () => {
    expect(read("LICENSE")).toContain("MIT License");
    expect(read("LICENSE")).toContain("Copyright (c) 2026 Lazurio contributors");
    for (const file of [
      "README.md",
      "AGENTS.md",
      "CHANGELOG.md",
      "NOTICE.md",
      "SECURITY.md",
      "CONTRIBUTING.md",
      "docs/adoption.md",
      "docs/extending.md",
      "docs/data.md",
      "docs/agents.md",
    ]) {
      expect({ file, exists: existsSync(resolve(ROOT, file)) }).toEqual({ file, exists: true });
    }
    expect(read("docs/extending.md")).toContain("app-data@2026.11");
    expect(read("docs/adoption.md")).toContain(
      "lazurio module create <Org>/<slug> --stack vite-react",
    );
    expect(read("docs/adoption.md")).toContain("git merge-base --is-ancestor");
  });

  test("exact versions, Bun 1.4.4 and the stack profile's pins", () => {
    expect(packageJson.packageManager).toBe("bun@1.4.4");
    const all = { ...packageJson.dependencies, ...packageJson.devDependencies } as Record<
      string,
      string
    >;
    for (const [name, version] of Object.entries(all)) {
      const exact =
        name === "design-system"
          ? parseDesignSystemPin(version) !== null
          : /^(\d+\.\d+\.\d+|github:Lazurio\/[a-z-]+#v\d+\.\d+\.\d+)$/.test(version);
      expect({ name, exact }).toEqual({ name, exact: true });
    }
    expect(all).toMatchObject({
      typescript: "7.0.2",
      vite: "8.3.5",
      react: "19.3.1",
      zod: "4.6.7",
      "@biomejs/biome": "2.6.4",
      "@lazurio/repository-db": "github:Lazurio/repository-db#v3.2.6",
      "@lazurio/module-kit": "github:Lazurio/module-kit#v0.2.0",
    });
    for (const workflow of [
      ".github/workflows/check.yml",
      ".github/workflows/windows-portability.yml",
    ]) {
      expect(read(workflow)).toContain("bun-version: 1.4.4");
      expect(read(workflow)).toContain("bun run check");
    }
  });

  test("declares the built version that runs from main, in one process", () => {
    const runtime = packageJson.lazurio.runtime;
    const scripts = packageJson.scripts as Record<string, string>;
    expect(runtime.dev_script).toBe("dev");
    expect(runtime.start_script).toBe("start");
    expect(runtime.build_script).toBe("build");
    expect(runtime.build_output).toBe("dist");
    for (const name of [
      runtime.dev_script,
      runtime.start_script,
      runtime.build_script,
      "check",
      "test",
      "validate:data",
    ]) {
      expect({ name, defined: typeof scripts[name] === "string" }).toEqual({ name, defined: true });
    }
    for (const name of [runtime.dev_script, runtime.start_script]) {
      expect(scripts[name]).toMatch(/^bun --no-env-file run [^&|;]+$/);
    }
    expect(scripts.check).toContain("validate:data");
    expect(scripts.check).toContain("bun test");
    expect(packageJson.lazurio.preparation.owner_package).toBe("app/v3/package.json");
  });

  test("carries the process for agents, the same for Codex and Claude Code", () => {
    const names = readdirSync(resolve(ROOT, ".agents/skills")).sort();
    expect(names).toEqual([
      "check-quote-before-sending",
      "prepare-quote-from-inquiry",
      "update-price-list-from-supplier",
    ]);
    for (const name of names) {
      const skill = read(`.agents/skills/${name}/SKILL.md`);
      expect(read(`.claude/skills/${name}/SKILL.md`)).toBe(skill);
      const [, frontmatter = ""] = /^---\n([\s\S]*?)\n---\n/.exec(skill) ?? [];
      expect(frontmatter).toContain(`name: ${name}`);
      const description = /^description: (.*)$/m.exec(frontmatter)?.[1] ?? "";
      expect(typeof JSON.parse(description)).toBe("string");
      expect(read("AGENTS.md")).toContain(`.agents/skills/${name}/SKILL.md`);
    }
  });

  test("every tracked path checks out on Windows", () => {
    const listed = spawnSync("git", ["-C", ROOT, "ls-files"], { encoding: "utf8" });
    if (listed.status !== 0) return;
    for (const path of listed.stdout.split("\n").filter(Boolean)) {
      const bad =
        /[<>:"|?*\\]/.test(path) ||
        path
          .split("/")
          .some(
            (part) => /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i.test(part) || /[ .]$/.test(part),
          ) ||
        path.length > 180;
      expect({ path, bad }).toEqual({ path, bad: false });
    }
  });
});

describe.skipIf(!TEMPLATE)("template contract (skipped in an adopted Module)", () => {
  test("the first release is proposed or dated, and the template pins the public design system", () => {
    expect(read("CHANGELOG.md")).toMatch(/^## 0\.1\.0 (\(proposed\)|— \d{4}-\d{2}-\d{2})$/m);
    expect(packageJson.dependencies["design-system"]).toBe(
      "github:LazurioTemplates/design-system#v2.0.0",
    );
  });

  test("leaves the Organization's identity as placeholders", () => {
    const manifest = JSON.parse(read("lazurio.module.json"));
    expect(manifest).toMatchObject({
      schema_version: "lazurio.module.v1",
      id: "quotes",
      company: "REPLACE-WITH-ORG-NAME",
      apps: ["app/v3/package.json"],
      default_app: "app/v3/package.json",
    });
    expect(packageJson.lazurio.runtime.company).toBe("REPLACE-WITH-ORG-NAME");
    expect(packageJson.lazurio.runtime.id).toBe("replace-with-org-slug-quotes-v3");
    expect(read("app/v3/config/data-repository.json")).toContain(
      "REPLACE-WITH-ORG-NAME/quotes-data",
    );
  });

  test("ships the same screenshots in Czech and English, 1600 px wide", () => {
    const cs = readdirSync(resolve(ROOT, "docs/screenshots/cs"))
      .filter((name) => name.endsWith(".webp"))
      .sort();
    const en = readdirSync(resolve(ROOT, "docs/screenshots/en"))
      .filter((name) => name.endsWith(".webp"))
      .sort();
    expect(cs.length).toBeGreaterThanOrEqual(4);
    expect(en).toEqual(cs);
    for (const locale of ["cs", "en"]) {
      for (const name of cs) {
        const file = readFileSync(resolve(ROOT, "docs/screenshots", locale, name));
        expect({ file: `${locale}/${name}`, width: webpWidth(file) }).toEqual({
          file: `${locale}/${name}`,
          width: 1600,
        });
      }
    }
  });
});

/** The canvas width of a WebP file (VP8, VP8L or VP8X). */
function webpWidth(bytes: Buffer): number {
  if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP")
    return -1;
  const chunk = bytes.toString("ascii", 12, 16);
  if (chunk === "VP8X") return 1 + bytes.readUIntLE(24, 3);
  if (chunk === "VP8 ") return bytes.readUInt16LE(26) & 0x3fff;
  if (chunk === "VP8L") return 1 + ((bytes.readUInt32LE(21) & 0x3fff) >>> 0);
  return -1;
}
