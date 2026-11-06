import { describe, expect, test } from "bun:test";
import { resolveLocale } from "../src/ui/locale.ts";

const json = (body: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } }),
  );

describe("the language of the App", () => {
  test("follows the person's Lazurio profile from the shell document", async () => {
    expect(await resolveLocale("", () => json({ schema: "lazurio.shell.v1", locale: "en" }))).toBe(
      "en",
    );
    expect(await resolveLocale("", () => json({ schema: "lazurio.shell.v1", locale: "cs" }))).toBe(
      "cs",
    );
  });

  test("takes the Module's setting when the shell does not answer, as on a module's origin", async () => {
    const load = (path: string) =>
      path === "/api/settings"
        ? json({ value: { language: "en" }, revision: "r" })
        : Promise.resolve(new Response("Not found", { status: 404 }));
    expect(await resolveLocale("", load)).toBe("en");
    expect(await resolveLocale("?lang=cs", load)).toBe("cs");
  });

  test("is Czech outside Lazurio, unless the address asks for English", async () => {
    const page = () =>
      Promise.resolve(
        new Response("<!doctype html>", { headers: { "content-type": "text/html" } }),
      );
    expect(await resolveLocale("", page)).toBe("cs");
    expect(await resolveLocale("", () => Promise.reject(new Error("offline")))).toBe("cs");
    expect(await resolveLocale("", () => json({ schema: "something.else", locale: "en" }))).toBe(
      "cs",
    );
    expect(await resolveLocale("?lang=en", page)).toBe("en");
    expect(await resolveLocale("?lang=de", page)).toBe("cs");
  });
});
