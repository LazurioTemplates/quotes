import { describe, expect, test } from "bun:test";
import type { ToolAuditEvent } from "@lazurio/module-kit/tools";
import {
  gatewayRequest,
  hostedEnvironment,
  mcpCall,
  mcpTool,
  mcpToolNames,
  pageTool,
  TEST_ORIGIN,
} from "@lazurio/module-kit/tools/testing";
import { createMemoryStore } from "../src/data/memory-store.ts";
import type { Locale } from "../src/i18n/locale.ts";
import { accessOf, LISTENER } from "../src/server/access.ts";
import { createAgentTools, createAgentToolsHandler } from "../src/server/agent-tools.ts";
import { CHANNEL_HEADER, createApi } from "../src/server/api.ts";
import { sampleData } from "./support/seed.ts";

const READ_TOOLS = [
  "check_quote",
  "find_customers",
  "find_items",
  "find_quotes",
  "get_app_context",
  "open_quote",
  "prepare_quote_email",
];
const WRITE_TOOLS = ["create_quote_draft", "preview_price_list_import"];

const CSV =
  "Kód;Název;MJ;Nákupní cena\nUV-2160;Výškově nastavitelný stůl 160 × 80 cm;ks;9 800,00\nUV-7777;Odkládací stolek;ks;1 100\n";

/** The App's API and its tools over the example in memory, as the
 * Application host runs them: the gateway states who came, `accessOf`
 * reads it as for every click. */
function setup(writer: boolean, locale: Locale = "en") {
  const audits: ToolAuditEvent[] = [];
  const channels: Array<string | null> = [];
  const env = hostedEnvironment({ writer, listener: LISTENER });
  const store = createMemoryStore(sampleData());
  const handle = createApi(store, {
    allowedOrigins: new Set([TEST_ORIGIN]),
    access: (request) => accessOf(request, env),
    today: () => "2026-11-06",
  });
  const api = (request: Request) => {
    channels.push(request.headers.get(CHANNEL_HEADER));
    return handle(request);
  };
  const tools = createAgentTools({
    api,
    origin: TEST_ORIGIN,
    locale,
    env,
    audit: (event) => audits.push(event),
  });
  return { store, tools, audits, channels, api, env };
}

const user = { role: "user" } as const;

describe("tools for agents", () => {
  test("an application user and admin see the reading and the writing tools while the App writes", async () => {
    const { tools } = setup(true);
    const all = [...READ_TOOLS, ...WRITE_TOOLS].sort();
    expect(await mcpToolNames(tools, user)).toEqual(all);
    expect(await mcpToolNames(tools, { role: "admin" })).toEqual(all);
  });

  test("a copy that may not write offers only the reading tools and refuses a write", async () => {
    const { tools, store } = setup(false);
    expect(await mcpToolNames(tools, user)).toEqual(READ_TOOLS);
    const before = (await store.listQuotes()).length;
    const { isError, structured } = await mcpTool(
      tools,
      "create_quote_draft",
      { customer_id: "C-0001", title: "Recepce" },
      user,
    );
    expect(isError).toBe(true);
    expect(structured.reason).toBe("data_read_only");
    const page = await pageTool(
      tools,
      "preview_price_list_import",
      { csv: CSV, supplier: "Ukázkový velkoobchod nábytku", valid_from: "2026-11-06" },
      user,
    );
    expect(page.status).toBe(403);
    expect(page.body.reason).toBe("data_read_only");
    expect((await store.listQuotes()).length).toBe(before);
    // The reading tools still answer.
    expect((await mcpTool(tools, "find_quotes", {}, user)).isError).toBe(false);
  });

  test("without a role /mcp and the page refuse with identity_unavailable", async () => {
    const { tools } = setup(true);
    const { status, body } = await mcpCall(tools, "tools/list", {}, { caller: { role: "none" } });
    expect(status).toBe(403);
    expect(body.error).toBe("identity_unavailable");
    const page = await pageTool(tools, "find_items", {}, { role: "none" });
    expect(page.status).toBe(403);
    expect(page.body.reason).toBe("identity_unavailable");
  });

  test("the data come from the API by the caller's role, as in the interface", async () => {
    const { tools, env, api } = setup(true);
    // The same request without a role is refused by the API itself.
    const refused = await api(gatewayRequest("/api/items", { caller: { role: "none" } }));
    expect(refused.status).toBe(403);
    expect(accessOf(gatewayRequest("/api/items", { caller: user }), env).admitted).toBe(true);

    const items = await mcpTool(tools, "find_items", { search: "led panel" }, user);
    expect(items.isError).toBe(false);
    expect((items.structured.items as Array<{ code: string }>).map((item) => item.code)).toEqual([
      "OSV-PANEL-6060",
    ]);
    const drafts = await mcpTool(tools, "find_quotes", { status: "draft" }, user);
    expect((drafts.structured.quotes as unknown[]).length).toBe(1);
    const customers = await mcpTool(tools, "find_customers", { search: "" }, user);
    expect((customers.structured.customers as unknown[]).length).toBe(3);
    const quote = await mcpTool(tools, "open_quote", { id: "NAB-2026-0002-v2" }, user);
    expect(quote.structured).toMatchObject({ number: "NAB-2026-0002", version: 2 });
    const missing = await mcpTool(tools, "open_quote", { id: "NAB-9999-v1" }, user);
    expect(missing.isError).toBe(true);
    expect(missing.structured.reason).toBe("not_found");
  });

  test("a tool's change goes through the API, saves a draft quote and is audited by channel", async () => {
    const { tools, store, audits, channels } = setup(true);
    const { isError, structured } = await mcpTool(
      tools,
      "create_quote_draft",
      { customer_id: "C-0001", title: "Recepce" },
      user,
    );
    expect(isError).toBe(false);
    expect(structured.id).toBe("NAB-2026-0006-v1");
    expect(structured.quote).toMatchObject({ status: "draft", title: "Recepce" });
    expect(
      (await store.listQuotes()).some((row) => row.value.number === "NAB-2026-0006"),
    ).toBeTrue();
    expect(channels.at(-1)).toBe("mcp");
    expect(audits.at(-1)).toMatchObject({
      tool: "create_quote_draft",
      channel: "mcp",
      outcome: "ok",
    });

    const check = await mcpTool(tools, "check_quote", { id: "NAB-2026-0006-v1" }, user);
    expect((check.structured.issues as Array<{ code: string }>).map((i) => i.code)).toContain(
      "no_lines",
    );
    // The API's own checks decide: an unknown customer is refused with its code.
    const unknown = await mcpTool(
      tools,
      "create_quote_draft",
      { customer_id: "C-9999", title: "X" },
      user,
    );
    expect(unknown.structured.reason).toBe("not_found");
  });

  test("the import preview shows the changes and saves nothing", async () => {
    const { tools, store } = setup(true);
    const before = await store.listItems();
    const { isError, structured } = await mcpTool(
      tools,
      "preview_price_list_import",
      { csv: CSV, supplier: "Ukázkový velkoobchod nábytku", valid_from: "2026-11-06" },
      user,
    );
    expect(isError).toBe(false);
    expect(String(structured.token)).toStartWith("preview:");
    expect(structured.preview).toBeDefined();
    expect(await store.listItems()).toEqual(before);
  });

  test("the page calls the same tools with its own session and channel", async () => {
    const { tools, channels, audits } = setup(true);
    const { status, body } = await pageTool(
      tools,
      "prepare_quote_email",
      { id: "NAB-2026-0002-v2" },
      user,
    );
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect((body.data as { print: string }).print).toBe("/print/quotes/NAB-2026-0002-v2?lang=en");
    expect(channels.at(-1)).toBe("webmcp");
    expect(audits.at(-1)).toMatchObject({ tool: "prepare_quote_email", channel: "webmcp" });
  });

  test("the tools speak the language the caller states, else the Module's settings", async () => {
    const env = hostedEnvironment({ writer: true });
    const store = createMemoryStore(sampleData());
    const api = createApi(store, {
      allowedOrigins: new Set([TEST_ORIGIN]),
      access: (request) => accessOf(request, env),
    });
    const handler = createAgentToolsHandler({
      api,
      origin: TEST_ORIGIN,
      env,
      audit: () => {},
      settingsLocale: async () => "cs",
    });
    const manifest = async (headers: Record<string, string>) => {
      const response = await handler.handlePage(
        gatewayRequest("/api/agent-tools", { caller: user, headers }),
      );
      const body = (await response?.json()) as {
        tools: Array<{ name: string; description: string }>;
      };
      return body.tools.find((tool) => tool.name === "find_items")?.description;
    };
    expect(await manifest({ "accept-language": "en-GB,en;q=0.8" })).toStartWith("Finds");
    expect(await manifest({})).toStartWith("Najde");
    expect(await handler.handlePage(gatewayRequest("/api/items", { caller: user }))).toBeNull();
  });
});
