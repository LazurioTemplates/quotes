import { dirname, relative, resolve, sep } from "node:path";
import { viewerHref } from "./routes";

// A rehype plugin: relative links between files of content/ work on GitHub
// (`../components/button.md`); in the viewer they are rewritten to the page
// that shows the target. Absolute URLs, anchors and root paths stay unchanged.
type Node = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: Node[];
};
type VFileLike = { path?: string; history?: string[] };

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/|#)/i;

export function rewriteContentLinks(contentRoot: string) {
  return () => (tree: Node, file: VFileLike) => {
    const source = file.path ?? file.history?.at(-1);
    if (!source) return;
    const from = dirname(resolve(source));
    const visit = (node: Node) => {
      const href = node.properties?.href;
      if (node.tagName === "a" && typeof href === "string" && !EXTERNAL.test(href)) {
        const [target = "", hash] = href.split("#");
        const inContent = relative(contentRoot, resolve(from, target)).split(sep).join("/");
        if (!inContent.startsWith("..")) {
          (node.properties as Record<string, unknown>).href = viewerHref(
            hash ? `${inContent}#${hash}` : inContent,
          );
        }
      }
      for (const child of node.children ?? []) visit(child);
    };
    visit(tree);
  };
}
