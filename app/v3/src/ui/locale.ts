import { DEFAULT_LOCALE, type Locale, parseLocale } from "../i18n/locale.ts";

/** The schema of the shell document Lazurio serves on every page (LazurioPlatform `src/shell/contract.ts`). */
const SHELL_SCHEMA = "lazurio.shell.v1";

/**
 * The language the App speaks, the first of:
 *
 * 1. `?lang=cs|en` in the address (development, the demo, screenshots);
 * 2. the language of the person's Lazurio profile in `/.lazurio/shell.json`
 *    (`lazurio.shell.v1`, `locale`), the document Lazurio's shell reads on
 *    its own origins. On a module's origin it does not arrive yet
 *    (LazurioPlatform#909): the App's own server answers 404 and this step
 *    passes at once;
 * 3. `language` of the Module's settings, which the start of the adoption
 *    sets and a person changes under Nastavení / Settings;
 * 4. Czech.
 */
export async function resolveLocale(
  search: string = typeof window === "undefined" ? "" : window.location.search,
  load: (path: string, timeoutMs?: number) => Promise<Response> = (path, timeoutMs) =>
    fetch(path, {
      headers: { accept: "application/json" },
      credentials: "same-origin",
      redirect: "manual",
      ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
    }),
): Promise<Locale> {
  const fromAddress = parseLocale(new URLSearchParams(search).get("lang"));
  if (fromAddress) return fromAddress;
  try {
    const response = await load("/.lazurio/shell.json", 1500);
    if (response.ok && (response.headers.get("content-type") ?? "").includes("json")) {
      const shell = (await response.json()) as { schema?: unknown; locale?: unknown } | null;
      if (shell?.schema === SHELL_SCHEMA) return parseLocale(shell.locale) ?? DEFAULT_LOCALE;
    }
  } catch {
    // No shell document: the App runs outside Lazurio, or on a module origin.
  }
  try {
    const response = await load("/api/settings");
    if (response.ok) {
      const stored = (await response.json()) as { value?: { language?: unknown } } | null;
      const language = parseLocale(stored?.value?.language);
      if (language) return language;
    }
  } catch {
    // The data is not available yet; the App says so in Czech.
  }
  return DEFAULT_LOCALE;
}
