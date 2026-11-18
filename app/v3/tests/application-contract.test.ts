import { describe, expect, test } from "bun:test";
import { withHealth } from "@lazurio/module-kit";
import {
  type GatewayCaller,
  gatewayRequest,
  hostedEnvironment,
  localEnvironment,
  TEST_ORIGIN,
} from "@lazurio/module-kit/tools/testing";
import { createMemoryStore } from "../src/data/memory-store.ts";
import { accessOf, type Env } from "../src/server/access.ts";
import { createApi } from "../src/server/api.ts";
import { sampleData } from "./support/seed.ts";

/**
 * The contract of a ready Application (Module Standard, Applications of an
 * Organization; docs/module-readiness.md of LazurioPlatform): who came only
 * through `appAccess`, no role grants nothing, one writer rule (`dataWriter`
 * of the module kit) and a deep health. The requests are the Application
 * host's gateway's, built by `@lazurio/module-kit/tools/testing`.
 */

function api(env: Env) {
  const store = createMemoryStore(sampleData());
  return createApi(store, {
    allowedOrigins: new Set([TEST_ORIGIN]),
    access: (request) => accessOf(request, env),
    today: () => "2026-11-06",
  });
}

const hosted = (writer?: boolean) =>
  hostedEnvironment({ ...(writer === undefined ? {} : { writer }) });

const roadmapChange = (caller: GatewayCaller) =>
  gatewayRequest("/api/draft/pull", { caller, origin: TEST_ORIGIN, body: {} });

describe("the Application's writer rule", () => {
  test("on the application host, false refuses every change before the store", async () => {
    const response = await api(hosted(false))(roadmapChange({ role: "admin" }));
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("data_read_only");
  });

  test("any value other than true refuses", async () => {
    const env = { ...hosted(), LAZURIO_RUNTIME_DATA_WRITER: "yes" };
    const response = await api(env)(roadmapChange({ role: "admin" }));
    expect(response.status).toBe(409);
  });

  test("without the variable, a person who has only the application cannot write", async () => {
    const env = { ...hosted(), LAZURIO_RUNTIME_DATA_WRITER: undefined };
    const response = await api(env)(roadmapChange({ role: "user" }));
    expect(response.status).toBe(409);
  });

  test("true lets a change reach the store", async () => {
    const response = await api(hosted(true))(roadmapChange({ role: "user" }));
    expect(response.status).not.toBe(409);
    expect(response.status).not.toBe(403);
  });

  test("without the variable, the Environment's own entry reaches the store", async () => {
    const env = { ...hosted(), LAZURIO_RUNTIME_DATA_WRITER: undefined };
    const response = await api(env)(roadmapChange({ role: "environment" }));
    expect(response.status).not.toBe(409);
    expect(response.status).not.toBe(403);
  });

  test("reading never needs the writer", async () => {
    const response = await api(hosted(false))(
      gatewayRequest("/api/items", { caller: { role: "user" } }),
    );
    expect(response.status).toBe(200);
  });
});

describe("who came", () => {
  test("a request through the gateway without a role gets nothing", async () => {
    const read = await api(hosted(true))(
      gatewayRequest("/api/items", { caller: { role: "none" } }),
    );
    expect(read.status).toBe(403);
    const change = await api(hosted(true))(roadmapChange({ role: "none" }));
    expect(change.status).toBe(403);
  });

  test("an Application User and an Application Admin read alike", async () => {
    for (const role of ["user", "admin"] as const) {
      const response = await api(hosted(true))(gatewayRequest("/api/items", { caller: { role } }));
      expect(response.status).toBe(200);
    }
  });

  test("a local entry in a development version is admitted and writes", () => {
    const env = localEnvironment("app");
    const access = accessOf(new Request("http://127.0.0.1:43100/api/items"), env);
    expect(access).toEqual({ admitted: true, mayWrite: true });
  });
});

describe("deep health", () => {
  test("health answers 503 until the data are open, then 200", async () => {
    let open = false;
    const health = withHealth(
      () => new Response("app"),
      "/healthz",
      () => open,
    );
    expect((await health(new Request(`${TEST_ORIGIN}/healthz`))).status).toBe(503);
    open = true;
    expect((await health(new Request(`${TEST_ORIGIN}/healthz`))).status).toBe(200);
  });
});
