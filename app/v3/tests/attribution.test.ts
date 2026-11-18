import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { TEST_ORIGIN } from "@lazurio/module-kit/tools/testing";
import { createRepositoryDbStore } from "../src/data/repository-db-store.ts";
import { CHANNEL_HEADER, createApi } from "../src/server/api.ts";
import { createFixtureRepo, git } from "./support/fixture-repo.ts";
import { newItem } from "./support/seed.ts";

// Real Git and the data repository's validator run here; see repository-db-store.test.ts.
setDefaultTimeout(60_000);

/**
 * Author and channel (Module Standard, One data port): every change records
 * the person's subject and the channel it came by, in the draft and when it
 * is published; a caller without a subject records none.
 */
function setup(subject: string | null) {
  const fixture = createFixtureRepo();
  const store = createRepositoryDbStore({
    mountRoot: fixture.mountRoot,
    expect: { remote: fixture.origin, branch: "v3", within: fixture.moduleRoot },
    intervalMs: 0,
  });
  const handle = createApi(store, {
    allowedOrigins: new Set([TEST_ORIGIN]),
    access: () => ({ admitted: true, mayWrite: true, subject }),
  });
  const call = (
    method: string,
    path: string,
    body: unknown,
    headers: Record<string, string> = {},
  ) =>
    handle(
      new Request(`${TEST_ORIGIN}${path}`, {
        method,
        headers: { "content-type": "application/json", origin: TEST_ORIGIN, ...headers },
        body: JSON.stringify(body),
      }),
    );
  const origins = async () =>
    ((await store.draft("en")).records ?? []).map(
      (record) => record.resource.changes[0]?.origin ?? null,
    );
  return { fixture, store, call, origins };
}

describe("author and channel", () => {
  test("a change from the interface records the person and the channel ui", async () => {
    const { fixture, store, call, origins } = setup("subject-1");
    try {
      expect(
        (await call("POST", "/api/customers", { record: { name: "Alfa s.r.o." } })).status,
      ).toBe(201);
      expect(await origins()).toEqual([
        expect.objectContaining({ kind: "app", actor: "subject-1", source: "quotes-v3/ui" }),
      ]);
    } finally {
      store.close();
      fixture.cleanup();
    }
  });

  test("a page tool's change is recorded as an agent's, channel webmcp", async () => {
    const { fixture, store, call, origins } = setup("subject-1");
    try {
      const response = await call(
        "POST",
        "/api/customers",
        { record: { name: "Beta s.r.o." } },
        { [CHANNEL_HEADER]: "webmcp" },
      );
      expect(response.status).toBe(201);
      expect(await origins()).toEqual([
        expect.objectContaining({ kind: "agent", actor: "subject-1", source: "quotes-v3/webmcp" }),
      ]);
    } finally {
      store.close();
      fixture.cleanup();
    }
  });

  test("a caller without a subject invents none", async () => {
    const { fixture, store, call, origins } = setup(null);
    try {
      expect(
        (await call("POST", "/api/customers", { record: { name: "Gama s.r.o." } })).status,
      ).toBe(201);
      const [origin] = await origins();
      expect(origin?.source).toBe("quotes-v3/ui");
      expect(origin?.actor).toBeUndefined();
    } finally {
      store.close();
      fixture.cleanup();
    }
  });

  test("a publication records who published and by which channel", async () => {
    const { fixture, store, call } = setup("subject-2");
    try {
      expect(
        (await call("POST", "/api/customers", { record: { name: "Delta s.r.o." } })).status,
      ).toBe(201);
      const card = await store.draft("en");
      const published = await call("POST", "/api/draft/publish", {
        expectedRevision: card.revision,
      });
      expect(published.status).toBe(200);
      const trailers = git(fixture.originPath, ["log", "-1", "--format=%(trailers:only)", "v3"]);
      expect(trailers).toContain("Repository-Db-Actor: subject-2");
      expect(trailers).toContain("Repository-Db-Source: quotes-v3/ui");
    } finally {
      store.close();
      fixture.cleanup();
    }
  });

  test("a change nobody stated the origin of is recorded as unknown, without a channel or a person", async () => {
    const { fixture, store, origins } = setup(null);
    try {
      await store.saveItem(newItem("NAB-BEZ-PUVODU"), null);
      const [origin] = await origins();
      expect(origin).toEqual(expect.objectContaining({ kind: "unknown", source: "quotes-v3" }));
      expect(origin?.actor).toBeUndefined();
    } finally {
      store.close();
      fixture.cleanup();
    }
  });

  test("a failure to record the origin never fails the saved write", async () => {
    const { fixture, store, call } = setup("subject-3");
    try {
      // The origin hint cannot be written: a directory stands where its file goes.
      mkdirSync(join(fixture.mountRoot, ".repository-db", "draft-origin.json"), {
        recursive: true,
      });
      const response = await call("POST", "/api/customers", { record: { name: "Epsilon s.r.o." } });
      expect(response.status).toBe(201);
      const saved = (await response.json()) as { value: { id: string } };
      expect(await store.getCustomer(saved.value.id)).not.toBeNull();
      expect(existsSync(join(fixture.mountRoot, "data/customers"))).toBe(true);
    } finally {
      store.close();
      fixture.cleanup();
    }
  });
});
