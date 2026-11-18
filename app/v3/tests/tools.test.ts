import { describe, expect, test } from "bun:test";
import { createMemoryStore } from "../src/data/memory-store.ts";
import { createApi } from "../src/server/api.ts";
import { api, setApiLocale } from "../src/ui/api.ts";
import { quoteTools, registerTools, type Tool } from "../src/ui/tools.ts";
import { sampleData } from "./support/seed.ts";

const ORIGIN = "http://127.0.0.1:24928";

/** The browser's `fetch` answered by the App's own API over the example data. */
function withApi<T>(run: () => Promise<T>): Promise<T> {
  const server = createApi(createMemoryStore(sampleData()), {
    allowedOrigins: new Set([ORIGIN]),
    access: () => ({ admitted: true, mayWrite: true }),
    today: () => "2026-11-06",
  });
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    headers.set("origin", ORIGIN);
    return server(new Request(new URL(String(input), ORIGIN), { ...init, headers }));
  }) as typeof fetch;
  return run().finally(() => {
    globalThis.fetch = original;
  });
}

const call = async (name: string, input: Record<string, unknown>) => {
  const tool = quoteTools(api, "cs", { canWrite: true }).find((entry) => entry.name === name);
  if (!tool) throw new Error(`no tool ${name}`);
  const result = await tool.execute(input);
  return JSON.parse(result.content[0]?.text ?? "null");
};

describe("WebMCP tools", () => {
  test("a copy that may not write offers only the reading tools", () => {
    const tools = quoteTools(api, "en", { canWrite: false });
    expect(tools.map((tool) => tool.name)).toEqual([
      "find_items",
      "find_customers",
      "find_quotes",
      "open_quote",
      "check_quote",
      "prepare_quote_email",
    ]);
  });

  test("name the main actions, each with an input schema, in both languages", () => {
    const tools = quoteTools(api, "en", { canWrite: true });
    expect(tools.map((tool) => tool.name)).toEqual([
      "find_items",
      "find_customers",
      "find_quotes",
      "open_quote",
      "create_quote_draft",
      "check_quote",
      "prepare_quote_email",
      "preview_price_list_import",
    ]);
    for (const tool of tools) {
      expect(tool.name).toMatch(/^[a-z]+(_[a-z]+)+$/);
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.description).not.toMatch(/[ěščřžýáíéůú]/);
    }
    expect(quoteTools(api, "cs", { canWrite: true })[0]?.description).toContain("Najde položky");
    expect(tools.map((tool) => tool.name).join(" ")).not.toMatch(/publish|send|delete/);
  });

  test("go through the App's own API and answer a refusal with its reason", async () => {
    setApiLocale("cs");
    await withApi(async () => {
      expect(
        (await call("find_items", { search: "led panel" })).map(
          (item: { code: string }) => item.code,
        ),
      ).toEqual(["OSV-PANEL-6060"]);
      expect((await call("find_quotes", { status: "draft" })).length).toBe(1);
      const created = await call("create_quote_draft", { customer_id: "C-0001", title: "Recepce" });
      expect(created.id).toBe("NAB-2026-0006-v1");
      const check = await call("check_quote", { id: "NAB-2026-0006-v1" });
      expect(check.map((issue: { code: string }) => issue.code)).toContain("no_lines");
      const email = await call("prepare_quote_email", { id: "NAB-2026-0002-v2" });
      expect(email.print).toBe("/print/quotes/NAB-2026-0002-v2?lang=cs");
      const refused = await call("open_quote", { id: "NAB-9999-v1" });
      expect(refused.refused).toBe("not_found");
    });
  });

  describe("registering again as the status changes", () => {
    const writable = () => quoteTools(api, "cs", { canWrite: true });
    const readable = () => quoteTools(api, "cs", { canWrite: false });
    const answer = async (tool: Tool | undefined) =>
      JSON.parse(
        (await tool?.execute({ customer_id: "C-0001", title: "X" }))?.content[0]?.text ?? "null",
      );

    test("a browser that only registers never sees a name twice, and a stale write tool refuses", async () => {
      const held = new Map<string, Tool>();
      const context = {
        registerTool: (tool: Tool) => {
          if (held.has(tool.name)) throw new Error("InvalidStateError: Duplicate tool name");
          held.set(tool.name, tool);
        },
      };
      const host = { document: { modelContext: context } };
      const stop = registerTools(writable(), host);
      stop(); // React running the effect twice
      const again = registerTools(writable(), host);
      again();
      registerTools(readable(), host);
      expect(held.size).toBe(8);
      expect((await answer(held.get("create_quote_draft"))).refused).toBe("data_read_only");
      expect((await answer(held.get("find_customers")))?.refused).not.toBe("data_read_only");
    });

    test("a browser that unregisters drops the write tools on a read-only copy", () => {
      const held = new Set<string>();
      const context = {
        registerTool: (tool: Tool) => {
          if (held.has(tool.name)) throw new Error("InvalidStateError: Duplicate tool name");
          held.add(tool.name);
        },
        unregisterTool: (name: string) => held.delete(name),
      };
      const host = { navigator: { modelContext: context } };
      registerTools(writable(), host)();
      registerTools(readable(), host);
      expect([...held].sort()).toEqual(
        readable()
          .map((tool) => tool.name)
          .sort(),
      );
    });

    test("a registration that unregisters itself is used", () => {
      const held = new Set<string>();
      const context = {
        registerTool: (tool: Tool) => {
          if (held.has(tool.name)) throw new Error("InvalidStateError: Duplicate tool name");
          held.add(tool.name);
          return { unregister: () => held.delete(tool.name) };
        },
      };
      const host = { navigator: { modelContext: context } };
      registerTools(writable(), host);
      registerTools(readable(), host);
      expect(held.has("create_quote_draft")).toBe(false);
      expect(held.has("find_quotes")).toBe(true);
    });

    test("a browser with only provideContext gets the whole set replaced", () => {
      const sets: string[][] = [];
      const host = {
        navigator: {
          modelContext: {
            provideContext: (c: { tools: Tool[] }) => sets.push(c.tools.map((t) => t.name)),
          },
        },
      };
      registerTools(writable(), host);
      registerTools(readable(), host);
      expect(sets.at(-1)).toEqual(readable().map((tool) => tool.name));
    });
  });

  test("register only where the browser has WebMCP", () => {
    const registered: string[] = [];
    const host = {
      navigator: {
        modelContext: { registerTool: (tool: { name: string }) => registered.push(tool.name) },
      },
    };
    const stop = registerTools(quoteTools(api, "cs", { canWrite: true }), host);
    expect(registered).toHaveLength(8);
    stop();
    expect(registerTools(quoteTools(api, "cs", { canWrite: true }), {})).toBeFunction();
  });
});
