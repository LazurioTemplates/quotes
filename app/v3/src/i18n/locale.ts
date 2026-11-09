/**
 * The two languages of Quotes. The App speaks the language of the person's
 * Lazurio profile, which Lazurio hands every page in `/.lazurio/shell.json`
 * (`lazurio.shell.v1`, field `locale`; see `src/ui/locale.ts`); without it,
 * Czech. The browser tells the server its language with `Accept-Language`,
 * the print page with `?lang=`, the agent's command line with `--lang`.
 */
export const LOCALES = ["cs", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "cs";

export function parseLocale(value: unknown): Locale | null {
  return value === "cs" || value === "en" ? value : null;
}

/** The first language of an `Accept-Language` header the App speaks, else Czech. */
export function localeOfAcceptLanguage(header: string | null | undefined): Locale {
  for (const part of (header ?? "").split(",")) {
    const tag = part.split(";")[0]?.trim().toLowerCase().split("-")[0];
    const locale = parseLocale(tag);
    if (locale) return locale;
  }
  return DEFAULT_LOCALE;
}

/** A text in both languages. */
export type Localized = Readonly<Record<Locale, string>>;

export function localized(cs: string, en: string): Localized {
  return { cs, en };
}

/** The text of `locale` from a pair written side by side: `pick(locale, "Ceník", "Price list")`. */
export function pick(locale: Locale, cs: string, en: string): string {
  return locale === "en" ? en : cs;
}
