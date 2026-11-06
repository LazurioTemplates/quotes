import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import packageJson from "../package.json";
import { routeOf } from "../src/lib/routes";

// The build contract of the Lazurio Module Standard (kap. 4.5): opened from
// `main`, the App runs as its build. The Launchpad runs `build_script` with only
// bun on PATH, `NODE_ENV=production` and no listener, then serves
// `build_output` with its own static server; the declared health path must
// resolve to a file of the output directly (a path ending in `/` to its
// `index.html`), because the probe does not follow redirects.
const app = resolve(import.meta.dir, "..");
const runtime = packageJson.lazurio.runtime;
const [entrypoint] = runtime.listeners;
if (!entrypoint) throw new Error("lazurio.runtime declares no listener");
const output = join(app, runtime.build_output);
const buildTimeoutMs = 120_000;

describe("build contract", () => {
  test(
    "builds without the listener environment and serves the health path as a file",
    () => {
      // As the Launchpad does, so that an earlier build never passes for this one.
      rmSync(output, { recursive: true, force: true });
      const run = Bun.spawnSync([process.execPath, "--no-env-file", "run", runtime.build_script], {
        cwd: app,
        env: {
          HOME: process.env.HOME ?? "",
          PATH: dirname(process.execPath),
          NODE_ENV: "production",
        },
        stdout: "pipe",
        stderr: "pipe",
      });
      if (run.exitCode !== 0) console.error(run.stderr.toString());
      expect(run.exitCode).toBe(0);
      const path = entrypoint.health.path;
      const files = path.endsWith("/") ? [`${path}index.html`] : [path, `${path}.html`];
      expect(files.some((file) => isFile(join(output, file)))).toBe(true);
      // Every page of content/ and the viewer's own pages are in the output.
      const missing = [...contentRoutes(), ...VIEWER_PAGES].filter(
        (route) => !isFile(join(output, route, "index.html")),
      );
      expect(missing).toEqual([]);
      // A modal is a native <dialog> named by its title, and every trigger opens
      // one that exists; a specimen claims no dialog role (content/components/dialog.md).
      for (const html of htmlFiles(output).map((file) => readFileSync(file, "utf8"))) {
        expect(html).not.toContain('role="dialog"');
        expect(html).not.toContain("aria-modal");
        for (const [, id, label] of html.matchAll(
          /<dialog[^>]*\bid="([^"]+)"[^>]*\baria-labelledby="([^"]+)"/g,
        )) {
          expect(html).toContain(`id="${label}"`);
          expect(id).toBeDefined();
        }
        expect((html.match(/<dialog\b/g) ?? []).length).toBe(
          (html.match(/<dialog[^>]*\baria-labelledby="/g) ?? []).length,
        );
        // A picture of a component holds no control and no live region.
        for (const [figure] of html.matchAll(
          /<figure class="(?:dialog-specimen|picture)[\s\S]*?<\/figure>/g,
        )) {
          expect(figure).not.toMatch(/\brole="(?:status|alert)"|aria-live/);
          expect(figure).not.toMatch(/<(?:button|a|input|textarea|select)\b|tabindex=/);
        }
        // Ids are unique on every page (the skip target and generated heading ids).
        const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(([, id]) => id);
        expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
        // No dead link anywhere, and outside the gallery every button does
        // something: open or close a dialog, show or close a toast, switch the theme.
        expect(html).not.toContain('href="#"');
        if (!html.includes("<h1>Gallery</h1>")) {
          for (const [button] of html.matchAll(/<button\b[^>]*>/g)) {
            expect(button).toMatch(
              /data-(?:dialog-open|dialog-close|toast|toast-close|theme-switch|menu-toggle|search-clear)\b/,
            );
          }
        }
        for (const [, target] of html.matchAll(/data-toast="([^"]+)"/g)) {
          expect(html).toMatch(new RegExp(`<template id="${target}"`));
        }
        for (const [, target] of html.matchAll(/data-dialog-open="([^"]+)"/g)) {
          expect(html).toMatch(new RegExp(`<dialog[^>]*\\bid="${target}"`));
        }
      }
    },
    buildTimeoutMs,
  );
});

const VIEWER_PAGES = [
  "foundations/tokens",
  "components/gallery",
  "screens/experiments",
  "screens/new-experiment",
  "screens/stop-or-scale",
  "screens/research-sources",
  "screens/experiment-update-email",
];

function contentRoutes(): string[] {
  const content = resolve(app, "../../content");
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return walk(path);
      return path.endsWith(".md") ? [routeOf(relative(content, path))] : [];
    });
  return walk(content);
}

function htmlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return path.endsWith(".html") ? [path] : [];
  });
}

function isFile(path: string): boolean {
  return statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;
}
