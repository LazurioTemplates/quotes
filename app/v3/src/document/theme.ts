import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { color, font, radius, size, space, type } from "design-system/tokens";

/**
 * The look of the quote document comes from the Organization's design system,
 * the package `design-system` (LazurioTemplates/design-system v2.0.0 in this
 * template, or the Organization's own release). The print page is HTML the
 * server renders, outside the App's bundle, so it takes the tokens from
 * `design-system/tokens` and writes them as the same `--ds-*` custom
 * properties the package's `tokens.css` declares; the document's stylesheet
 * (`document-css.ts`) uses only those names. Paper is light, so only the
 * light theme is written.
 */
export function designSystemStylesheet(): string {
  const declarations = [
    ...Object.entries(color.light).map(([role, value]) => `--ds-color-${role}: ${value};`),
    ...Object.entries(font).map(([name, value]) => `--ds-font-${name}: ${value};`),
    ...Object.entries(type).flatMap(([role, style]) => [
      `--ds-type-${role}-font: var(--ds-font-${style.font});`,
      `--ds-type-${role}-size: ${style.size};`,
      `--ds-type-${role}-leading: ${style.leading};`,
      `--ds-type-${role}-weight: ${style.weight};`,
      `--ds-type-${role}-tracking: ${style.tracking};`,
    ]),
    ...Object.entries(space).map(([step, value]) => `--ds-space-${step}: ${value};`),
    ...Object.entries(radius).map(([step, value]) => `--ds-radius-${step}: ${value};`),
    ...Object.entries(size).map(([name, value]) => `--ds-size-${name}: ${value};`),
  ];
  return `:root { color-scheme: light; ${declarations.join(" ")} }`;
}

/** Where the package keeps its fonts: beside its `fonts.css`. */
function fontsStylesheetPath(): string {
  return Bun.resolveSync("design-system/fonts.css", import.meta.dir);
}

/** The package's `@font-face` rules, their files served under `base` (`/print/fonts/`). */
export function fontStylesheet(base: string): string {
  return readFileSync(fontsStylesheetPath(), "utf8").replace(
    /url\("\.\/fonts\/([a-z0-9-]+\.woff2)"\)/g,
    (_match, file: string) => `url("${base}${file}")`,
  );
}

/** A font file of the package, or null for a name it does not have. */
export function fontFile(name: string): string | null {
  if (!/^[a-z0-9-]+\.woff2$/.test(name)) return null;
  return join(dirname(fontsStylesheetPath()), "fonts", name);
}
