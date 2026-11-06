import raw from "../../../content/brand/colors/tokens.json";

// The design tokens the viewer renders. content/brand/colors/tokens.json is
// the source of truth; the viewer only reads it.
//
// `colors` holds the primitive palette. `themes` maps every colour role to a
// primitive, once for light and once for dark; components use roles only.
// `typography`, `space` and `radius` are the scales; `size` (controls, table
// rows, icons), `stroke`, `width`, `breakpoint` (px) and `motion` (ms) are the
// other dimensions a page of content/ may prescribe. Pages name them; only
// this file holds their values.
export type TypeStyle = { size: number; lineHeight: number; weight: number };

export type DesignTokens = {
  name: string;
  status: string;
  source: string;
  colors: Record<string, string>;
  themes: Record<ThemeName, Record<Role, string>>;
  typography: { families: Record<"sans" | "mono", string>; scale: Record<string, TypeStyle> };
  space: Record<string, number>;
  radius: Record<string, number>;
  size: Record<string, number>;
  stroke: Record<string, number>;
  width: Record<string, number>;
  breakpoint: Record<string, number>;
  motion: Record<string, number>;
};

export const THEMES = ["light", "dark"] as const;
export type ThemeName = (typeof THEMES)[number];

// Every theme defines every role. A component never names a primitive.
export const ROLES = [
  "surface",
  "surface-raised",
  "surface-sunken",
  "text",
  "text-muted",
  "text-subtle",
  "border",
  "border-strong",
  "accent",
  "accent-hover",
  "on-accent",
  "accent-text",
  "accent-subtle",
  "focus",
  "highlight",
  "on-highlight",
  "success",
  "success-subtle",
  "warning",
  "warning-subtle",
  "danger",
  "danger-subtle",
  "scrim",
] as const;
export type Role = (typeof ROLES)[number];

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function nonNegative(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${path} must be a non-negative number`);
  }
  return value;
}

export function parseTokens(value: unknown): DesignTokens {
  if (typeof value !== "object" || value === null) throw new Error("tokens must be an object");
  const {
    name,
    status,
    source,
    colors,
    themes,
    typography,
    space,
    radius,
    size,
    stroke,
    width,
    breakpoint,
    motion,
  } = value as Record<string, unknown>;
  for (const [field, text] of Object.entries({ name, status, source })) {
    if (typeof text !== "string" || text.length === 0) {
      throw new Error(`tokens.${field} must be a non-empty string`);
    }
  }
  if (typeof colors !== "object" || colors === null || Array.isArray(colors)) {
    throw new Error("tokens.colors must be an object of named colours");
  }
  const entries = Object.entries(colors);
  for (const [colour, hex] of entries) {
    if (typeof hex !== "string" || !HEX_COLOR.test(hex)) {
      throw new Error(`tokens.colors.${colour} must be a #rrggbb colour`);
    }
  }
  const palette = Object.fromEntries(entries) as Record<string, string>;

  const themeMap = record(themes, "tokens.themes");
  const parsedThemes = {} as Record<ThemeName, Record<Role, string>>;
  for (const theme of THEMES) {
    const roles = record(themeMap[theme], `tokens.themes.${theme}`);
    const unknown = Object.keys(roles).filter(
      (role) => !(ROLES as readonly string[]).includes(role),
    );
    if (unknown.length > 0) throw new Error(`tokens.themes.${theme}.${unknown[0]} is not a role`);
    const mapped = {} as Record<Role, string>;
    for (const role of ROLES) {
      const primitive = roles[role];
      if (typeof primitive !== "string" || !(primitive in palette)) {
        throw new Error(`tokens.themes.${theme}.${role} must name a colour of tokens.colors`);
      }
      mapped[role] = primitive;
    }
    parsedThemes[theme] = mapped;
  }

  const type = record(typography, "tokens.typography");
  const families = record(type.families, "tokens.typography.families");
  for (const family of ["sans", "mono"]) {
    if (typeof families[family] !== "string" || families[family] === "") {
      throw new Error(`tokens.typography.families.${family} must be a font stack`);
    }
  }
  const scale: Record<string, TypeStyle> = {};
  for (const [style, spec] of Object.entries(record(type.scale, "tokens.typography.scale"))) {
    const s = record(spec, `tokens.typography.scale.${style}`);
    scale[style] = {
      size: nonNegative(s.size, `tokens.typography.scale.${style}.size`),
      lineHeight: nonNegative(s.lineHeight, `tokens.typography.scale.${style}.lineHeight`),
      weight: nonNegative(s.weight, `tokens.typography.scale.${style}.weight`),
    };
  }

  const scaleOf = (input: unknown, path: string) =>
    Object.fromEntries(
      Object.entries(record(input, path)).map(([key, v]) => [
        key,
        nonNegative(v, `${path}.${key}`),
      ]),
    );

  return {
    name: name as string,
    status: status as string,
    source: source as string,
    colors: palette,
    themes: parsedThemes,
    typography: {
      families: { sans: families.sans as string, mono: families.mono as string },
      scale,
    },
    space: scaleOf(space, "tokens.space"),
    radius: scaleOf(radius, "tokens.radius"),
    size: scaleOf(size, "tokens.size"),
    stroke: scaleOf(stroke, "tokens.stroke"),
    width: scaleOf(width, "tokens.width"),
    breakpoint: scaleOf(breakpoint, "tokens.breakpoint"),
    motion: scaleOf(motion, "tokens.motion"),
  };
}

// WCAG 2.x relative luminance and contrast ratio of two #rrggbb colours.
function luminance(hex: string): number {
  const channel = (offset: number) => {
    const c = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

export function roleColor(t: DesignTokens, theme: ThemeName, role: Role): string {
  return t.colors[t.themes[theme][role]] as string;
}

// The CSS custom properties of one theme: `--<role>` for colours, plus the
// scales as `--space-<n>`, `--radius-<name>` and `--font-<family>`.
export function themeVariables(t: DesignTokens, theme: ThemeName): string {
  return ROLES.map((role) => `--${role}: ${roleColor(t, theme, role)};`).join(" ");
}

export function scaleVariables(t: DesignTokens): string {
  return [
    ...Object.entries(t.space).map(([k, v]) => `--space-${k}: ${v}px;`),
    ...Object.entries(t.radius).map(([k, v]) => `--radius-${k}: ${v}px;`),
    ...(["size", "stroke", "width", "breakpoint"] as const).flatMap((group) =>
      Object.entries(t[group]).map(([k, v]) => `--${group}-${k}: ${v}px;`),
    ),
    ...Object.entries(t.motion).map(([k, v]) => `--motion-${k}: ${v}ms;`),
    `--font-sans: ${t.typography.families.sans};`,
    `--font-mono: ${t.typography.families.mono};`,
    ...Object.entries(t.typography.scale).map(
      ([k, s]) => `--type-${k}: ${s.weight} ${s.size}px/${s.lineHeight}px var(--font-sans);`,
    ),
  ].join(" ");
}

// The stylesheet that turns the tokens into CSS: light by default, dark when
// the reader's system prefers it, and either one wherever `data-theme` is set:
// on <html> by the viewer's switch, or on a panel that shows one theme.
export function tokenStylesheet(t: DesignTokens): string {
  const light = themeVariables(t, "light");
  const dark = themeVariables(t, "dark");
  return [
    `:root { color-scheme: light; ${scaleVariables(t)} ${light} }`,
    `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { color-scheme: dark; ${dark} } }`,
    `[data-theme="dark"] { color-scheme: dark; ${dark} }`,
    `[data-theme="light"] { color-scheme: light; ${light} }`,
  ].join("\n");
}

// The signal dot as the favicon, in the light theme's accent.
export function faviconHref(t: DesignTokens): string {
  const fill = roleColor(t, "light", "accent");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="${fill}"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const tokens = parseTokens(raw);
