import { DEFAULT_LOCALE, type Locale, parseLocale } from "../i18n/locale.ts";

/** The schema of the shell document Lazurio serves on every page (LazurioPlatform `src/shell/contract.ts`). */
const SHELL_SCHEMA = "lazurio.shell.v1";

/**
 * The language the App speaks. Lazurio hands every page the language of the
 * person's profile in `/.lazurio/shell.json` (`lazurio.shell.v1`, `locale`
 * `cs` or `en`), the document its shell's elements read; the App reads the
 * same field. Outside Lazurio (development, `bun run dev:demo`, screenshots)
 * there is no such document and `?lang=en` in the address chooses English;
 * otherwise the App speaks Czech.
 */
export async function resolveLocale(
  search: string = typeof window === "undefined" ? "" : window.location.search,
  load: (path: string) => Promise<Response> = (path) =>
    fetch(path, { headers: { accept: "application/json" }, credentials: "same-origin" }),
): Promise<Locale> {
  const fromAddress = parseLocale(new URLSearchParams(search).get("lang"));
  if (fromAddress) return fromAddress;
  try {
    const response = await load("/.lazurio/shell.json");
    if (response.ok && (response.headers.get("content-type") ?? "").includes("json")) {
      const shell = (await response.json()) as { schema?: unknown; locale?: unknown } | null;
      if (shell?.schema === SHELL_SCHEMA) return parseLocale(shell.locale) ?? DEFAULT_LOCALE;
    }
  } catch {
    // No shell document: the App runs outside Lazurio.
  }
  return DEFAULT_LOCALE;
}
