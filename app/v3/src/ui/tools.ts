import { latestVersions, QUOTE_STATUSES } from "../domain/quote.ts";
import { type Locale, pick } from "../i18n/locale.ts";
import { ApiError, type api, printUrl } from "./api.ts";

/**
 * The App's main actions as WebMCP tools (Module Standard, "Tools for
 * agents"): an agent in the Environment browser lists and calls them with
 * `agent-browser webmcp list` and `webmcp invoke`. Each tool calls the same
 * HTTP API as the interface's button. None publishes, sends or deletes: a
 * draft quote is the furthest a tool goes, and publishing stays the person's
 * button in "Koncept a publikování" / "Draft & publish".
 */
export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute(input: Record<string, unknown>): Promise<{ content: { type: "text"; text: string }[] }>;
}

type Client = Pick<
  typeof api,
  | "items"
  | "customers"
  | "quotes"
  | "quote"
  | "createQuote"
  | "checkQuote"
  | "email"
  | "importPreview"
>;

const text = (value: unknown) => ({
  content: [
    {
      type: "text" as const,
      text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
    },
  ],
});

const string = (description: string) => ({ type: "string", description });

export function quoteTools(client: Client, locale: Locale): Tool[] {
  const t = (cs: string, en: string) => pick(locale, cs, en);
  /** A refusal is an answer with its reason, never a thrown page error. */
  const answer = async (operation: () => Promise<unknown>) => {
    try {
      return text(await operation());
    } catch (error) {
      return text({
        refused: error instanceof ApiError ? error.code : "unexpected",
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  };
  const words = (value: unknown) =>
    String(value ?? "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
  return [
    {
      name: "find_items",
      description: t(
        "Najde položky ceníku podle slov v kódu, názvu nebo dodavateli. Vrátí kód, název, jednotku a ceny v haléřích.",
        "Finds price list items by words of their code, name or supplier. Returns code, name, unit and prices in minor units (1/100 of the currency).",
      ),
      inputSchema: {
        type: "object",
        properties: { search: string(t("hledaná slova", "words to look for")) },
      },
      execute: (input) =>
        answer(async () => {
          const wanted = words(input.search);
          return (await client.items())
            .map((entry) => entry.value)
            .filter((item) => !item.archived)
            .filter((item) =>
              wanted.every((word) =>
                `${item.code} ${item.name} ${item.supplier ?? ""}`.toLowerCase().includes(word),
              ),
            );
        }),
    },
    {
      name: "find_customers",
      description: t(
        "Najde zákazníky podle názvu, IČO, e-mailu nebo kontaktní osoby.",
        "Finds customers by name, company ID, e-mail or contact person.",
      ),
      inputSchema: {
        type: "object",
        properties: { search: string(t("hledaná slova", "words to look for")) },
      },
      execute: (input) =>
        answer(async () => {
          const wanted = words(input.search);
          return (await client.customers())
            .map((entry) => entry.value)
            .filter((customer) =>
              wanted.every((word) =>
                `${customer.name} ${customer.company_id ?? ""} ${customer.email ?? ""} ${customer.contact_person ?? ""}`
                  .toLowerCase()
                  .includes(word),
              ),
            );
        }),
    },
    {
      name: "find_quotes",
      description: t(
        "Vypíše poslední verzi každé nabídky, případně jen v jednom stavu.",
        "Lists the latest version of every quote, or of those in one state.",
      ),
      inputSchema: {
        type: "object",
        properties: { status: { type: "string", enum: [...QUOTE_STATUSES] } },
      },
      execute: (input) =>
        answer(async () =>
          latestVersions((await client.quotes()).map((entry) => entry.value)).filter(
            (quote) => !input.status || quote.status === input.status,
          ),
        ),
    },
    {
      name: "open_quote",
      description: t(
        "Vrátí jednu verzi nabídky podle id (číslo-vN) s řádky.",
        "Returns one version of a quote by its id (number-vN) with its lines.",
      ),
      inputSchema: {
        type: "object",
        properties: { id: string("NAB-2026-0002-v2") },
        required: ["id"],
      },
      execute: (input) => answer(async () => (await client.quote(String(input.id))).value),
    },
    {
      name: "create_quote_draft",
      description: t(
        "Založí koncept nabídky s dalším číslem pro zákazníka. Nic neposílá ani nepublikuje; řádky doplní člověk nebo agent v editoru.",
        "Creates a draft quote with the next number for a customer. It sends and publishes nothing; the lines come in the editor.",
      ),
      inputSchema: {
        type: "object",
        properties: {
          customer_id: string("C-0001"),
          title: string(t("předmět nabídky", "subject of the quote")),
        },
        required: ["customer_id", "title"],
      },
      execute: (input) =>
        answer(async () => {
          const created = await client.createQuote({
            customer_id: String(input.customer_id),
            title: String(input.title),
          });
          return { id: `${created.value.number}-v${created.value.version}`, quote: created.value };
        }),
    },
    {
      name: "check_quote",
      description: t(
        "Zkontroluje nabídku před odesláním: chyby, které odeslání brání, a upozornění.",
        "Checks a quote before it goes out: the errors that stop it and the warnings.",
      ),
      inputSchema: {
        type: "object",
        properties: { id: string("NAB-2026-0004-v1") },
        required: ["id"],
      },
      execute: (input) => answer(() => client.checkQuote(String(input.id))),
    },
    {
      name: "prepare_quote_email",
      description: t(
        "Připraví text e-mailu k nabídce, název PDF a adresu tiskové stránky. E-mail neodešle: odeslání je na člověku.",
        "Prepares the e-mail text of a quote, the PDF's name and the print page's address. It does not send: sending is the person's.",
      ),
      inputSchema: {
        type: "object",
        properties: { id: string("NAB-2026-0002-v2") },
        required: ["id"],
      },
      execute: (input) =>
        answer(async () => ({
          ...(await client.email(String(input.id))),
          print: printUrl(String(input.id), locale),
        })),
    },
    {
      name: "preview_price_list_import",
      description: t(
        "Ukáže, co by ceník dodavatele (CSV) v ceníku změnil. Nic neukládá.",
        "Shows what a supplier's price list (CSV) would change in the price list. It saves nothing.",
      ),
      inputSchema: {
        type: "object",
        properties: {
          csv: string(t("obsah CSV", "the CSV text")),
          supplier: string(
            t("dodavatel, jak ho zná ceník", "the supplier as the price list names it"),
          ),
          valid_from: string("YYYY-MM-DD"),
          markup_percent: { type: "number" },
          round_to_crowns: { type: "boolean" },
        },
        required: ["csv", "supplier", "valid_from"],
      },
      execute: (input) =>
        answer(() =>
          client.importPreview({
            csv: String(input.csv),
            options: {
              supplier: String(input.supplier),
              valid_from: String(input.valid_from),
              ...(typeof input.markup_percent === "number"
                ? { markup_percent: input.markup_percent }
                : {}),
              ...(input.round_to_crowns === true ? { round_to_crowns: true } : {}),
            },
          }),
        ),
    },
  ];
}

interface ModelContext {
  registerTool?(tool: Tool): unknown;
  unregisterTool?(name: string): unknown;
  provideContext?(context: { tools: Tool[] }): unknown;
}

/** Registers the tools where the browser has WebMCP; elsewhere does nothing. */
export function registerTools(tools: readonly Tool[], host: unknown = globalThis): () => void {
  const scope = host as {
    document?: { modelContext?: ModelContext };
    navigator?: { modelContext?: ModelContext };
  };
  const context = scope.document?.modelContext ?? scope.navigator?.modelContext;
  if (!context) return () => {};
  if (context.registerTool) {
    for (const tool of tools) context.registerTool(tool);
    return () => {
      for (const tool of tools) context.unregisterTool?.(tool.name);
    };
  }
  context.provideContext?.({ tools: [...tools] });
  return () => context.provideContext?.({ tools: [] });
}
