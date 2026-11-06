import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { documentCss } from "../src/document/document-css.ts";
import { designSystemStylesheet, designTokens } from "../src/document/theme.ts";

const MODULE_ROOT = resolve(import.meta.dir, "..", "..", "..");

describe("the quote document and the design system", () => {
  test("the design system is a whole release carried in design-system/, not a copy of parts", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(MODULE_ROOT, "design-system", "lazurio.module.json"), "utf8"),
    );
    expect(manifest.id).toBe("design-system");
    const app = JSON.parse(
      readFileSync(resolve(MODULE_ROOT, "design-system", "app", "v1", "package.json"), "utf8"),
    );
    expect(app.version).toBe("1.0.0");
    expect(readFileSync(resolve(MODULE_ROOT, "design-system", "LICENSE"), "utf8")).toContain(
      "MIT License",
    );
    expect(designTokens.name).toBe("Example");
  });

  test("the document's stylesheet names only what the design system defines", () => {
    const tokens = designSystemStylesheet();
    const used = [
      ...new Set([...documentCss.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((match) => match[1])),
    ];
    expect(used.length).toBeGreaterThan(10);
    for (const name of used)
      expect({ name, defined: tokens.includes(`${name}:`) }).toEqual({ name, defined: true });
  });

  test("the document has no colour of its own", () => {
    expect(documentCss).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(documentCss).not.toMatch(/\b(rgb|rgba|hsl|hsla|oklch)\(/i);
    expect(documentCss).toContain("@page { size: A4;");
  });
});
