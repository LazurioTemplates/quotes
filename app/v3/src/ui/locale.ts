import { resolveLocale as chooseLocale, readLazurioLocale } from "design-system";
import { DEFAULT_LOCALE, type Locale, parseLocale } from "../i18n/locale.ts";

/**
 * The language the App speaks, by the design system's rule (Lazurio's,
 * decision 0142): an explicit choice first, then the language Lazurio gives,
 * then Czech.
 *
 * 1. The explicit choice is `?lang=cs|en` in the address (development, the
 *    demo, screenshots).
 * 2. Lazurio gives the language of the person's profile in
 *    `/.lazurio/shell.json`, read by the design system's `readLazurioLocale`.
 *    On a module's origin it does not arrive yet (LazurioPlatform#909), so
 *    the App takes the language of the Module's settings in its place, which
 *    the start of the adoption sets and a person changes under Settings.
 * 3. Czech.
 */
export type Load = (path: string, init?: RequestInit) => Promise<Response>;

export async function resolveLocale(
  search: string = typeof window === "undefined" ? "" : window.location.search,
  load: Load = (path, init) => fetch(path, init),
): Promise<Locale> {
  const explicit = parseLocale(new URLSearchParams(search).get("lang"));
  const lazurio = explicit
    ? null
    : ((await readLazurioLocale(load as typeof fetch, AbortSignal.timeout(1500))) ??
      (await settingsLocale(load)));
  return chooseLocale({ explicit, lazurio }) ?? DEFAULT_LOCALE;
}

async function settingsLocale(load: Load): Promise<Locale | null> {
  try {
    const response = await load("/api/settings", { headers: { accept: "application/json" } });
    if (!response.ok) return null;
    const stored = (await response.json()) as { value?: { language?: unknown } } | null;
    return parseLocale(stored?.value?.language);
  } catch {
    // The data is not available yet; the App says so in Czech.
    return null;
  }
}
