import { describe, expect, test } from "bun:test";
import type { AppAccess } from "@lazurio/module-kit";
import { hostedEnvironment } from "@lazurio/module-kit/tools/testing";
import type { WebMcpTool } from "@lazurio/module-kit/webmcp";
import { LOCALES } from "../src/i18n/locale.ts";
import { createAgentTools, TOOL_DESCRIPTIONS, type ToolName } from "../src/server/agent-tools.ts";
import { fetchIn, installTools } from "../src/ui/tools.ts";

const NAMES = [
  "find_items",
  "find_customers",
  "find_quotes",
  "open_quote",
  "create_quote_draft",
  "check_quote",
  "prepare_quote_email",
  "preview_price_list_import",
];

const ADMIN = {
  entry: "app",
  appRole: "admin",
  person: { subject: "2659b76d-0000-4000-8000-000000000001", username: "me" },
  source: "gateway",
  reason: null,
} as AppAccess;

describe("tools for agents: names, inputs and the page", () => {
  test("the server's tools are named verb first, take JSON Schema inputs, speak both languages and publish nothing", () => {
    for (const locale of LOCALES) {
      const registry = createAgentTools({
        api: async () => Response.json({}),
        origin: "http://127.0.0.1:24952",
        locale,
        env: hostedEnvironment({ writer: true }),
        audit: () => {},
      });
      const own = registry.list(ADMIN).filter((tool) => tool.name !== "get_app_context");
      expect(own.map((tool) => tool.name)).toEqual(NAMES);
      for (const tool of own) {
        expect(tool.name).toMatch(/^[a-z]+(?:_[a-z]+)+$/);
        expect(tool.inputSchema.type).toBe("object");
        expect(tool.inputSchema.additionalProperties).toBe(false);
        expect(tool.description).toBe(TOOL_DESCRIPTIONS[tool.name as ToolName][locale]);
        expect(tool.effect).not.toBe("publish");
        expect(tool.annotations.destructiveHint).toBe(false);
      }
      if (locale === "en")
        for (const tool of own) expect(tool.description).not.toMatch(/[ěščřžýáíéůú]/);
      expect(own.map((tool) => tool.name).join(" ")).not.toMatch(/publish|send|delete/);
    }
  });

  test("the inputs the old page tools took are still required", () => {
    const registry = createAgentTools({
      api: async () => Response.json({}),
      origin: "http://127.0.0.1:24952",
      locale: "cs",
      env: hostedEnvironment({ writer: true }),
      audit: () => {},
    });
    const required = Object.fromEntries(
      registry.list(ADMIN).map((tool) => [tool.name, tool.inputSchema.required ?? []]),
    );
    expect(required.open_quote).toEqual(["id"]);
    expect(required.create_quote_draft).toEqual(["customer_id", "title"]);
    expect(required.preview_price_list_import).toEqual(["csv", "supplier", "valid_from"]);
    expect(required.find_items).toEqual([]);
  });

  test("the page registers what its server lists, in its language, and asks again", async () => {
    const registered: string[] = [];
    const asked: Array<string | null> = [];
    const context = {
      registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => {
        registered.push(tool.name);
        options?.signal?.addEventListener("abort", () => {
          registered.splice(registered.indexOf(tool.name), 1);
        });
      },
    };
    let names = ["find_items", "create_quote_draft"];
    const server = (async (_input: string | URL | Request, init?: RequestInit) => {
      asked.push(new Headers(init?.headers).get("accept-language"));
      return Response.json({
        tools: names.map((name) => ({
          name,
          description: name,
          inputSchema: { type: "object" },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
        })),
      });
    }) as typeof fetch;
    const installed = installTools("en", { modelContext: context, fetch: server });
    await Bun.sleep(0);
    expect(registered).toEqual(["find_items", "create_quote_draft"]);
    names = ["find_items"];
    installed.refresh();
    await Bun.sleep(0);
    await Bun.sleep(0);
    expect(registered).toEqual(["find_items"]);
    expect(asked).toEqual(["en", "en"]);
    installed.remove();
    expect(registered).toEqual([]);
  });

  test("a browser whose registration rejects on abort leaves no unhandled rejection, and refresh registers again", async () => {
    // As the WebMCP API in the Environment browser: `registerTool` returns a
    // promise that rejects with an `AbortError` once its signal aborts.
    const registered: string[] = [];
    const context = {
      registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => {
        registered.push(tool.name);
        return new Promise<void>((_resolve, reject) => {
          options?.signal?.addEventListener("abort", () => {
            registered.splice(registered.indexOf(tool.name), 1);
            reject(new DOMException("signal is aborted without reason", "AbortError"));
          });
        });
      },
    };
    const server = (async () =>
      Response.json({
        tools: ["find_items", "find_quotes"].map((name) => ({
          name,
          description: name,
          inputSchema: { type: "object" },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
        })),
      })) as unknown as typeof fetch;
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    try {
      const settle = async () => {
        for (let turn = 0; turn < 5; turn += 1) await Bun.sleep(0);
      };
      const installed = installTools("cs", { modelContext: context, fetch: server });
      await settle();
      expect(registered).toEqual(["find_items", "find_quotes"]);
      // As after `/api/status`: the page asks again, twice in a row.
      installed.refresh();
      installed.refresh();
      await settle();
      expect(registered).toEqual(["find_items", "find_quotes"]);
      installed.remove();
      expect(registered).toEqual([]);
      installed.refresh();
      await settle();
      expect(registered).toEqual([]);
      // A page whose registration is removed before it finished.
      const early = installTools("en", { modelContext: context, fetch: server });
      early.remove();
      await settle();
      expect(registered).toEqual([]);
      await Bun.sleep(10);
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  test("without WebMCP nothing is registered and the page works the same", async () => {
    const installed = installTools("cs", { modelContext: null });
    installed.refresh();
    installed.remove();
    let header: string | null = null;
    await fetchIn("cs", (async (_input: string | URL | Request, init?: RequestInit) => {
      header = new Headers(init?.headers).get("accept-language");
      return new Response();
    }) as typeof fetch)("/api/agent-tools", { headers: { accept: "application/json" } });
    expect(header as string | null).toBe("cs");
  });
});
