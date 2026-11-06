import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { toStableYaml } from "@lazurio/repository-db";
import { createRepositoryDbStore } from "../src/data/repository-db-store.ts";
import { storeContract } from "./store-contract.ts";
import { colleagueClone, createFixtureRepo, git } from "./support/fixture-repo.ts";
import { newQuote } from "./support/seed.ts";

// These tests run real Git and the data repository's validator for every
// publish. On a Windows runner one publish takes several seconds, more than
// bun's default of 5 s per test, so they get a minute.
setDefaultTimeout(60_000);

function storeOver(fixture: ReturnType<typeof createFixtureRepo>, remote = fixture.origin) {
  return createRepositoryDbStore({
    mountRoot: fixture.mountRoot,
    expect: { remote, branch: "v3", within: fixture.moduleRoot },
    intervalMs: 0,
  });
}

storeContract("repository-db", async () => {
  const fixture = createFixtureRepo();
  return { store: storeOver(fixture), cleanup: fixture.cleanup };
});

describe("repository-db store", () => {
  test("keeps the collection layout and publishes one validated commit", async () => {
    const fixture = createFixtureRepo();
    const store = storeOver(fixture);
    try {
      await store.saveQuote(newQuote(), null);
      const path = "data/quotes/NAB-2026-0006-v1.yaml";
      expect(existsSync(join(fixture.mountRoot, path))).toBe(true);
      const card = await store.draft();
      expect(card.records?.[0]?.technicalPath).toBe(path);
      expect(card.records?.[0]?.resource.routeTarget?.href).toBe("#/quotes/NAB-2026-0006-v1");

      await store.publish({
        expectedRevision: card.revision ?? "",
        summary: "Nabídka NAB-2026-0006",
      });
      const log = git(fixture.originPath, ["log", "-1", "--format=%s%n%(trailers:only)", "v3"]);
      expect(log).toContain("Nabídka NAB-2026-0006");
      expect(log).toContain("Repository-Db-Source: quotes-v3");
      expect(git(fixture.originPath, ["rev-list", "--count", "v3"])).toBe("2");
    } finally {
      store.close();
      fixture.cleanup();
    }
  });

  test("refuses a publish the data repository's validator rejects", async () => {
    const fixture = createFixtureRepo();
    const store = storeOver(fixture);
    try {
      // An agent wrote a broken record by hand, past the App and its command line.
      writeFileSync(
        join(fixture.mountRoot, "data/items/BROKEN.yaml"),
        toStableYaml({ schemaVersion: "quotes.item.v1", id: "BROKEN", record: { code: "BROKEN" } }),
      );
      expect((await store.check()).length).toBeGreaterThan(0);
      expect((await store.check("en"))[0]?.message).toContain("required");
      const card = await store.draft();
      let code: string | undefined;
      try {
        await store.publish({ expectedRevision: card.revision ?? "" });
      } catch (error) {
        code = (error as { code?: string }).code;
      }
      expect(code).toBe("validation_failed");
      expect(git(fixture.originPath, ["rev-list", "--count", "v3"])).toBe("1");
    } finally {
      store.close();
      fixture.cleanup();
    }
  });

  test("serves only its own data repository", async () => {
    const fixture = createFixtureRepo();
    const store = storeOver(fixture, "git@github.com:SomeoneElse/quotes-data.git");
    try {
      const available = await store.available();
      expect(available.ok).toBe(false);
      if (!available.ok) expect(available.code).toBe("boundary_violation");
    } finally {
      store.close();
      fixture.cleanup();
    }
  });

  test("takes a colleague's published work and says which records changed", async () => {
    const fixture = createFixtureRepo();
    const store = storeOver(fixture);
    try {
      const colleague = colleagueClone(fixture);
      const file = join(colleague, "data/quotes/NAB-2026-0002-v2.yaml");
      writeFileSync(
        file,
        readFileSync(file, "utf8")
          .replace("status: sent", "status: accepted")
          .replace("updated_at: 2026-10-12", "closed_at: 2026-11-02\n  updated_at: 2026-11-02"),
      );
      git(colleague, ["commit", "--quiet", "--all", "--message", "NAB-2026-0002 přijata"]);
      git(colleague, ["push", "--quiet"]);

      const events: string[] = [];
      const stop = store.subscribe((event) => events.push(event.type));
      await store.pull();
      stop();
      expect((await store.getQuote("NAB-2026-0002-v2"))?.value.status).toBe("accepted");
      expect(events).toContain("records-changed");
    } finally {
      store.close();
      fixture.cleanup();
    }
  });
});
