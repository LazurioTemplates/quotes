import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { documentCss } from "../src/document/document-css.ts";
import { designSystemStylesheet, fontFile, fontStylesheet } from "../src/document/theme.ts";

describe("the quote document and the design system", () => {
  test("the print page writes the package's own token names", () => {
    const written = [...designSystemStylesheet().matchAll(/(--ds-[a-z0-9-]+):/g)].map(
      (match) => match[1] as string,
    );
    expect(written.length).toBeGreaterThan(50);
    const declared = readFileSync(
      Bun.resolveSync("design-system/tokens.css", import.meta.dir),
      "utf8",
    );
    for (const name of written) {
      expect({ name, declared: declared.includes(`${name}:`) }).toEqual({ name, declared: true });
    }
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

  test("the App's own stylesheet uses only the design system's tokens", () => {
    const styles = readFileSync(resolve(import.meta.dir, "..", "src", "ui", "styles.css"), "utf8");
    const declared = readFileSync(
      Bun.resolveSync("design-system/tokens.css", import.meta.dir),
      "utf8",
    );
    const used = [
      ...new Set([...styles.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((match) => match[1])),
    ];
    expect(used.length).toBeGreaterThan(30);
    for (const name of used) {
      expect({ name, declared: declared.includes(`${name}:`) }).toEqual({ name, declared: true });
    }
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    const entry = readFileSync(resolve(import.meta.dir, "..", "src", "ui", "main.tsx"), "utf8");
    expect(entry.indexOf('import "design-system/styles.css"')).toBeGreaterThan(-1);
    expect(entry.indexOf('import "design-system/styles.css"')).toBeLessThan(
      entry.indexOf('import "./styles.css"'),
    );
  });

  test("the print page takes the package's fonts and serves only their files", () => {
    const faces = fontStylesheet("/print/fonts/");
    expect(faces).toContain('url("/print/fonts/inter-latin-ext-wght-normal.woff2")');
    expect(faces).not.toContain("./fonts/");
    const file = fontFile("inter-latin-wght-normal.woff2");
    expect(file && existsSync(file)).toBe(true);
    expect(fontFile("../../package.json")).toBeNull();
    expect(fontFile("LICENSE-inter.txt")).toBeNull();
  });
});
