import { fileURLToPath } from "node:url";
import { unified } from "@astrojs/markdown-remark";
import { astroServerOptions, ModuleKitError, onShutdown } from "@lazurio/module-kit";
import { defineConfig } from "astro/config";
import { rewriteContentLinks } from "./src/lib/md-links";

const LISTENER = "app";

// Host and port come only from the Launchpad listener (Lazurio Module Standard
// 4.2). Astro evaluates `server` during `astro build`, `astro check` and
// `astro sync` too, so the listener is read only when Astro serves.
const serving = process.argv.includes("dev") || process.argv.includes("preview");

function listenerServer(): ReturnType<typeof astroServerOptions> {
  try {
    return astroServerOptions(LISTENER);
  } catch (error) {
    if (!(error instanceof ModuleKitError)) throw error;
    console.error(`Start through Lazurio lifecycle: ${error.message}`);
    process.exit(2);
  }
}

// SIGTERM from the Launchpad ends the dev server with exit 0 (standard 4.4).
if (serving) onShutdown(() => undefined);

// The Markdown of content/ links between its files relatively, as on GitHub;
// the viewer rewrites those links to its own pages. The rewrite is a rehype
// plugin, so the App keeps the unified() processor that Astro 7 no longer
// installs by default (upgrade guide to v7, Markdown processor).
const contentRoot = fileURLToPath(new URL("../../content/", import.meta.url));

export default defineConfig({
  ...(serving ? { server: listenerServer() } : {}),
  // Code blocks take the theme's own colours (global.css), not a highlighter's.
  markdown: {
    syntaxHighlight: false,
    processor: unified({ rehypePlugins: [rewriteContentLinks(contentRoot)] }),
  },
  vite: {
    // No .env* files on the start path (standard 4.3).
    envDir: false,
    server: { strictPort: true },
    preview: { strictPort: true },
  },
});
