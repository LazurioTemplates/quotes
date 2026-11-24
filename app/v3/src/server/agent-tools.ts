import {
  createToolRegistry,
  defineTool,
  type ToolAuditEvent,
  type ToolContext,
  type ToolRegistry,
  type ToolResult,
} from "@lazurio/module-kit/tools";
import { z } from "zod";
import packageJson from "../../package.json";
import type { Item } from "../domain/catalog.ts";
import { isoDate } from "../domain/common.ts";
import type { Customer } from "../domain/customer.ts";
import { percent } from "../domain/money.ts";
import { latestVersions, QUOTE_STATUSES, type Quote } from "../domain/quote.ts";
import { LOCALES, type Locale, type Localized, localized } from "../i18n/locale.ts";
import { LISTENER } from "./access.ts";
import { CHANNEL_HEADER } from "./api.ts";

/**
 * The App's tools for agents (Module Standard, "Agents in the App"), defined
 * once on the server and offered on `/mcp` and to the page
 * (`/api/agent-tools`, registered by `@lazurio/module-kit/webmcp`).
 *
 * Every tool calls the App's own HTTP API in the same process, with the
 * caller's request headers, so the API decides who may do what exactly as it
 * does for a click: the application role, the one writer rule and the
 * record's revision. The channel (`mcp` or `webmcp`) goes with every change,
 * so the draft records it as an agent's. No tool publishes, sends or deletes:
 * a draft quote is the furthest a tool goes, publishing stays the person's
 * button in "Koncept a publikování" / "Draft & publish" and sending the
 * quote is the person's step outside the App.
 */

type Api = (request: Request) => Promise<Response>;

/** The page endpoints of the registry (the module kit's default). */
export const AGENT_TOOLS_PATH = "/api/agent-tools";

/** What each tool does, in both languages; the registry of a language
 * speaks that one. */
export const TOOL_DESCRIPTIONS = {
  find_items: localized(
    "Najde položky ceníku podle slov v kódu, názvu nebo dodavateli. Vrátí kód, název, jednotku a ceny v haléřích.",
    "Finds price list items by words of their code, name or supplier. Returns code, name, unit and prices in minor units (1/100 of the currency).",
  ),
  find_customers: localized(
    "Najde zákazníky podle názvu, IČO, e-mailu nebo kontaktní osoby.",
    "Finds customers by name, company ID, e-mail or contact person.",
  ),
  find_quotes: localized(
    "Vypíše poslední verzi každé nabídky, případně jen v jednom stavu.",
    "Lists the latest version of every quote, or of those in one state.",
  ),
  open_quote: localized(
    "Vrátí jednu verzi nabídky podle id (číslo-vN) s řádky.",
    "Returns one version of a quote by its id (number-vN) with its lines.",
  ),
  create_quote_draft: localized(
    "Založí koncept nabídky s dalším číslem pro zákazníka. Nic neposílá ani nepublikuje; řádky doplní člověk nebo agent v editoru.",
    "Creates a draft quote with the next number for a customer. It sends and publishes nothing; the lines come in the editor.",
  ),
  check_quote: localized(
    "Zkontroluje nabídku před odesláním: chyby, které odeslání brání, a upozornění.",
    "Checks a quote before it goes out: the errors that stop it and the warnings.",
  ),
  prepare_quote_email: localized(
    "Připraví text e-mailu k nabídce, název PDF a adresu tiskové stránky. E-mail neodešle: odeslání je na člověku.",
    "Prepares the e-mail text of a quote, the PDF's name and the print page's address. It does not send: sending is the person's.",
  ),
  preview_price_list_import: localized(
    "Ukáže, co by ceník dodavatele (CSV) v ceníku změnil. Nic neukládá.",
    "Shows what a supplier's price list (CSV) would change in the price list. It saves nothing.",
  ),
} as const satisfies Record<string, Localized>;

export type ToolName = keyof typeof TOOL_DESCRIPTIONS;

const INSTRUCTIONS = localized(
  "Cenové nabídky: ceník, zákazníci a nabídky. Částky jsou celé haléře. Každá změna je koncept; publikování konceptu i odeslání nabídky zákazníkovi dělá člověk.",
  "Quotes: the price list, customers and quotes. Amounts are whole minor units (1/100 of the currency). Every change is a draft; publishing the draft and sending a quote to the customer are the person's.",
);

const TITLE = localized("Cenové nabídky", "Quotes");

/** The API takes a CSV of up to 5 000 000 characters (`/api/import/preview`);
 * its JSON body fits this bound, the kit's default of 64 KiB would not. */
const MAX_BODY_BYTES = 32 * 1024 * 1024;

const schemaOf = (schema: z.ZodType) =>
  z.toJSONSchema(schema, { io: "input" }) as Record<string, unknown>;

function inputs(locale: Locale) {
  const say = (text: Localized) => text[locale];
  const search = z.strictObject({
    search: z
      .string()
      .max(500)
      .optional()
      .describe(say(localized("hledaná slova", "words to look for"))),
  });
  const quoteId = z.strictObject({
    id: z.string().min(1).max(200).describe("NAB-2026-0002-v2"),
  });
  return {
    search,
    quoteId,
    status: z.strictObject({ status: z.enum(QUOTE_STATUSES).optional() }),
    newQuote: z.strictObject({
      customer_id: z.string().min(1).max(200).describe("C-0001"),
      title: z
        .string()
        .trim()
        .min(1)
        .max(500)
        .describe(say(localized("předmět nabídky", "subject of the quote"))),
    }),
    importPreview: z.strictObject({
      csv: z
        .string()
        .min(1)
        .max(5_000_000)
        .describe(say(localized("obsah CSV", "the CSV text"))),
      supplier: z
        .string()
        .trim()
        .min(1)
        .describe(
          say(localized("dodavatel, jak ho zná ceník", "the supplier as the price list names it")),
        ),
      valid_from: isoDate.describe("YYYY-MM-DD"),
      markup_percent: percent.optional(),
      round_to_crowns: z.boolean().optional(),
    }),
  };
}

/** The headers the API reads who came by, copied from the caller's request;
 * the body headers, the channel and the language are the tool's own. */
function forwardedHeaders(context: ToolContext, origin: string, locale: Locale): Headers {
  const headers = new Headers(context.request.headers);
  for (const name of [
    "content-length",
    "content-type",
    "accept",
    "accept-language",
    "origin",
    CHANNEL_HEADER,
  ])
    headers.delete(name);
  headers.set(CHANNEL_HEADER, context.channel);
  headers.set("accept", "application/json");
  headers.set("accept-language", locale);
  // The registry has already admitted the call (the gateway's statement on
  // `/mcp`, the App's own origin on the page); the API's cross-site check
  // sees the App's own origin.
  headers.set("origin", origin);
  return headers;
}

/** The API's answer as a tool result: data, or the API's refusal with its code. */
async function resultOf(response: Response): Promise<ToolResult<object>> {
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const refusal = (body ?? {}) as { code?: unknown; message?: unknown; issues?: unknown };
    const reason = typeof refusal.code === "string" ? refusal.code : "unavailable";
    const message =
      typeof refusal.message === "string" && refusal.message
        ? refusal.message
        : `The App answered HTTP ${response.status}.`;
    const issues = Array.isArray(refusal.issues) && refusal.issues.length > 0 ? refusal.issues : [];
    return {
      ok: false,
      reason,
      message,
      ...(issues.length > 0 ? { details: { issues } } : {}),
    };
  }
  return { ok: true, data: (body ?? {}) as object };
}

const words = (value: string | undefined) =>
  (value ?? "").toLowerCase().split(/\s+/).filter(Boolean);

const matches = (wanted: string[], haystack: string) => {
  const text = haystack.toLowerCase();
  return wanted.every((word) => text.includes(word));
};

type Stored<T> = { value: T; revision: string };

export interface AgentToolsOptions {
  /** The App's HTTP API (`createApi`). */
  api: Api;
  /** One of the App's own origins, which the API accepts for a change. */
  origin: string;
  /** The language the tools' descriptions and the API's answers speak. */
  locale: Locale;
  env?: Record<string, string | undefined>;
  /** Receives every call's audit line (default: one JSON line to stdout). */
  audit?: (event: ToolAuditEvent) => void;
}

/** The App's tools in one language. */
export function createAgentTools(options: AgentToolsOptions): ToolRegistry {
  const { api, origin, locale } = options;
  const input = inputs(locale);
  const describe = (name: ToolName) => TOOL_DESCRIPTIONS[name][locale];

  /** One request to the API; the answer as it came. */
  const request = async (
    context: ToolContext,
    path: string,
    init?: { method: string; body: unknown },
  ): Promise<ToolResult<object>> => {
    const headers = forwardedHeaders(context, origin, locale);
    if (init) headers.set("content-type", "application/json");
    return resultOf(
      await api(
        new Request(new URL(path, origin), {
          method: init?.method ?? "GET",
          headers,
          ...(init ? { body: JSON.stringify(init.body) } : {}),
        }),
      ),
    );
  };
  /** One request, with its data shaped for the agent. */
  const call = async <T>(
    context: ToolContext,
    path: string,
    shape: (data: T) => object,
    init?: { method: string; body: unknown },
  ): Promise<ToolResult<object>> => {
    const result = await request(context, path, init);
    return result.ok ? { ok: true, data: shape(result.data as T) } : result;
  };
  const quotePath = (id: string, tail = "") => `/api/quotes/${encodeURIComponent(id)}${tail}`;

  return createToolRegistry({
    app: {
      module: "quotes",
      version: packageJson.version,
      dataGeneration: "v3",
      title: TITLE[locale],
      instructions: INSTRUCTIONS[locale],
    },
    listener: LISTENER,
    pagePath: AGENT_TOOLS_PATH,
    maxBodyBytes: MAX_BODY_BYTES,
    ...(options.env ? { env: options.env } : {}),
    ...(options.audit ? { audit: options.audit } : {}),
    tools: [
      defineTool({
        name: "find_items",
        description: describe("find_items"),
        input: input.search,
        inputSchema: schemaOf(input.search),
        minRole: "user",
        effect: "read",
        untrustedContent: true,
        run: ({ search }, context) =>
          call<Stored<Item>[]>(context, "/api/items", (rows) => {
            const wanted = words(search);
            return {
              items: rows
                .map((row) => row.value)
                .filter((item) => !item.archived)
                .filter((item) =>
                  matches(wanted, `${item.code} ${item.name} ${item.supplier ?? ""}`),
                ),
            };
          }),
      }),
      defineTool({
        name: "find_customers",
        description: describe("find_customers"),
        input: input.search,
        inputSchema: schemaOf(input.search),
        minRole: "user",
        effect: "read",
        untrustedContent: true,
        run: ({ search }, context) =>
          call<Stored<Customer>[]>(context, "/api/customers", (rows) => {
            const wanted = words(search);
            return {
              customers: rows
                .map((row) => row.value)
                .filter((customer) =>
                  matches(
                    wanted,
                    `${customer.name} ${customer.company_id ?? ""} ${customer.email ?? ""} ${customer.contact_person ?? ""}`,
                  ),
                ),
            };
          }),
      }),
      defineTool({
        name: "find_quotes",
        description: describe("find_quotes"),
        input: input.status,
        inputSchema: schemaOf(input.status),
        minRole: "user",
        effect: "read",
        untrustedContent: true,
        run: ({ status }, context) =>
          call<Stored<Quote>[]>(context, "/api/quotes", (rows) => ({
            quotes: latestVersions(rows.map((row) => row.value)).filter(
              (quote) => !status || quote.status === status,
            ),
          })),
      }),
      defineTool({
        name: "open_quote",
        description: describe("open_quote"),
        input: input.quoteId,
        inputSchema: schemaOf(input.quoteId),
        minRole: "user",
        effect: "read",
        untrustedContent: true,
        run: ({ id }, context) =>
          call<Stored<Quote>>(context, quotePath(id), (found) => found.value),
      }),
      defineTool({
        name: "create_quote_draft",
        description: describe("create_quote_draft"),
        input: input.newQuote,
        inputSchema: schemaOf(input.newQuote),
        minRole: "user",
        effect: "write",
        untrustedContent: true,
        run: (body, context) =>
          call<Stored<Quote>>(
            context,
            "/api/quotes",
            (created) => ({
              id: `${created.value.number}-v${created.value.version}`,
              quote: created.value,
            }),
            { method: "POST", body },
          ),
      }),
      defineTool({
        name: "check_quote",
        description: describe("check_quote"),
        input: input.quoteId,
        inputSchema: schemaOf(input.quoteId),
        minRole: "user",
        effect: "read",
        untrustedContent: true,
        run: ({ id }, context) =>
          call<unknown[]>(context, quotePath(id, "/check"), (issues) => ({ issues })),
      }),
      defineTool({
        name: "prepare_quote_email",
        description: describe("prepare_quote_email"),
        input: input.quoteId,
        inputSchema: schemaOf(input.quoteId),
        minRole: "user",
        // It prepares the person's step of sending and changes nothing.
        effect: "prepare",
        untrustedContent: true,
        run: ({ id }, context) =>
          call<object>(context, quotePath(id, "/email"), (email) => ({
            ...email,
            print: `/print/quotes/${encodeURIComponent(id)}?lang=${locale}`,
          })),
      }),
      defineTool({
        name: "preview_price_list_import",
        description: describe("preview_price_list_import"),
        input: input.importPreview,
        inputSchema: schemaOf(input.importPreview),
        minRole: "user",
        // The preview saves nothing, but it is the first step of a change:
        // the API takes it as one (a POST that a copy which may not write
        // refuses with `data_read_only`) and the import page is not offered
        // there. As a write, a copy that may not write does not list it.
        effect: "write",
        idempotent: true,
        untrustedContent: true,
        run: ({ csv, markup_percent, round_to_crowns, ...options }, context) =>
          call<object>(context, "/api/import/preview", (preview) => preview, {
            method: "POST",
            body: {
              csv,
              options: {
                ...options,
                ...(markup_percent === undefined ? {} : { markup_percent }),
                ...(round_to_crowns === true ? { round_to_crowns: true } : {}),
              },
            },
          }),
      }),
    ],
  });
}

/** The tools in the language of each request, over one registry per language. */
export interface AgentToolsHandler {
  /** Answers `/mcp`. */
  handleMcp(request: Request): Promise<Response>;
  /** Answers the page endpoints, or `null` for any other path. */
  handlePage(request: Request): Promise<Response | null>;
}

/** The first language of an `Accept-Language` header the App speaks, or null. */
export function statedLocale(header: string | null): Locale | null {
  for (const part of (header ?? "").split(",")) {
    const tag = part.split(";")[0]?.trim().toLowerCase().split("-")[0];
    const found = LOCALES.find((locale) => locale === tag);
    if (found) return found;
  }
  return null;
}

/**
 * The tools as the server offers them. The page states its language
 * (`Accept-Language`, as every request of the interface does); a caller that
 * states none gets the language of the Module's settings, then Czech.
 */
export function createAgentToolsHandler(
  options: Omit<AgentToolsOptions, "locale"> & {
    /** The language of the Module's settings, or null while it is unknown. */
    settingsLocale: () => Promise<Locale | null>;
  },
): AgentToolsHandler {
  const { settingsLocale, ...shared } = options;
  const registries = new Map(
    LOCALES.map((locale) => [locale, createAgentTools({ ...shared, locale })]),
  );
  const registryFor = async (request: Request): Promise<ToolRegistry> => {
    const locale =
      statedLocale(request.headers.get("accept-language")) ??
      (await settingsLocale().catch(() => null)) ??
      "cs";
    return registries.get(locale) as ToolRegistry;
  };
  return {
    handleMcp: async (request) => (await registryFor(request)).handleMcp(request),
    handlePage: async (request) => {
      const path = new URL(request.url).pathname;
      if (path !== AGENT_TOOLS_PATH && !path.startsWith(`${AGENT_TOOLS_PATH}/`)) return null;
      return (await registryFor(request)).handlePage(request);
    },
  };
}
