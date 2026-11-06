import { describe, expect, test } from "bun:test";
import {
  contrastRatio,
  parseTokens,
  ROLES,
  type Role,
  roleColor,
  THEMES,
  tokenStylesheet,
  tokens,
} from "../src/tokens";

describe("design tokens", () => {
  test("the committed tokens name the Organization and declare colours", () => {
    expect(tokens.name.length).toBeGreaterThan(0);
    expect(Object.keys(tokens.colors).length).toBeGreaterThan(0);
  });

  test("rejects a colour that is not #rrggbb", () => {
    expect(() =>
      parseTokens({
        name: "x",
        status: "draft",
        source: "BASELINE.md",
        colors: { accent: "blue" },
      }),
    ).toThrow("tokens.colors.accent");
  });

  test("rejects tokens without colours", () => {
    expect(() =>
      parseTokens({ name: "x", status: "draft", source: "BASELINE.md", tokens: {} }),
    ).toThrow("tokens.colors");
  });

  test("rejects a role that names no primitive colour", () => {
    const light = { ...tokens.themes.light, accent: "signal-1000" };
    expect(() => parseTokens({ ...tokens, themes: { ...tokens.themes, light } })).toThrow(
      "tokens.themes.light.accent",
    );
  });

  test("rejects a theme that misses a role or invents one", () => {
    const { focus: _focus, ...missing } = tokens.themes.dark;
    expect(() => parseTokens({ ...tokens, themes: { ...tokens.themes, dark: missing } })).toThrow(
      "tokens.themes.dark.focus",
    );
    const invented = { ...tokens.themes.dark, sparkle: "lumen-400" };
    expect(() => parseTokens({ ...tokens, themes: { ...tokens.themes, dark: invented } })).toThrow(
      "tokens.themes.dark.sparkle is not a role",
    );
  });

  test("every theme maps every role", () => {
    for (const theme of THEMES) {
      expect(Object.keys(tokens.themes[theme]).sort()).toEqual([...ROLES].sort());
    }
  });

  test("the stylesheet sets every role for both themes", () => {
    const css = tokenStylesheet(tokens);
    for (const role of ROLES) expect(css).toContain(`--${role}: `);
    expect(css).toContain("prefers-color-scheme: dark");
    expect(css).toContain('[data-theme="dark"]');
  });
});

// WCAG 2.2 AA: 4.5:1 for text, 3:1 for the boundaries of controls and for focus
// indicators. The pairs are the ones the components actually use.
describe("contrast (WCAG AA) in both themes", () => {
  const surfaces: Role[] = ["surface", "surface-raised", "surface-sunken"];
  const textRoles: Role[] = [
    "text",
    "text-muted",
    "text-subtle",
    "accent-text",
    "success",
    "warning",
    "danger",
  ];
  const pairs: [Role, Role, number][] = [
    ...textRoles.flatMap((fg) => surfaces.map((bg): [Role, Role, number] => [fg, bg, 4.5])),
    ["on-accent", "accent", 4.5],
    ["on-accent", "accent-hover", 4.5],
    ["on-highlight", "highlight", 4.5],
    ["accent-text", "accent-subtle", 4.5],
    ["text", "accent-subtle", 4.5],
    ["success", "success-subtle", 4.5],
    ["warning", "warning-subtle", 4.5],
    ["danger", "danger-subtle", 4.5],
    ["border-strong", "surface", 3],
    ["border-strong", "surface-raised", 3],
    ["focus", "surface", 3],
    ["focus", "surface-raised", 3],
    ["accent", "surface", 3],
    ["accent", "surface-raised", 3],
  ];
  for (const theme of THEMES) {
    for (const [fg, bg, minimum] of pairs) {
      test(`${theme}: ${fg} on ${bg} is at least ${minimum}:1`, () => {
        const ratio = contrastRatio(roleColor(tokens, theme, fg), roleColor(tokens, theme, bg));
        expect(ratio).toBeGreaterThanOrEqual(minimum);
      });
    }
  }

  test("the ratio is the WCAG one", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });
});

describe("scales", () => {
  test("spacing is a 4 px grid that grows", () => {
    const values = Object.values(tokens.space);
    for (const v of values) expect(v % 4).toBe(0);
    expect([...values].sort((a, b) => a - b)).toEqual(values);
  });

  test("the type scale keeps line height above size and body at 16 px", () => {
    for (const style of Object.values(tokens.typography.scale)) {
      expect(style.lineHeight).toBeGreaterThanOrEqual(style.size);
    }
    expect(tokens.typography.scale.body?.size).toBe(16);
  });
});
