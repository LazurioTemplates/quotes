// Routes of the viewer for files of content/. A Markdown file's route is its
// path without `.md`; a section's README.md is the section itself
// (`brand/README.md` → `brand`). The viewer's own pages (Tokens, Gallery and
// the screens) are not content and have fixed routes.
export const REPOSITORY = "https://github.com/LazurioTemplates/design-system";

export function routeOf(contentPath: string): string {
  return contentPath
    .replace(/\\/g, "/")
    .replace(/\.md$/i, "")
    .replace(/(^|\/)README$/i, "")
    .replace(/\/$/, "");
}

export function hrefOf(route: string): string {
  return route === "" ? "/" : `/${route}/`;
}

// Content files that the viewer shows as one of its own pages instead of on
// GitHub.
const RENDERED_FILES: Record<string, string> = {
  "brand/colors/tokens.json": "/foundations/tokens/",
  "templates/email/experiment-update.html": "/screens/experiment-update-email/",
};

// Where a link from one content file to another (`../components/button.md`)
// leads in the viewer: a Markdown file to its route, a file the viewer renders
// to that page, any other file to its source on GitHub.
export function viewerHref(contentPath: string): string {
  const [path = "", hash] = contentPath.split("#");
  const suffix = hash ? `#${hash}` : "";
  if (/\.md$/i.test(path)) return `${hrefOf(routeOf(path))}${suffix}`;
  const rendered = RENDERED_FILES[path];
  if (rendered) return `${rendered}${suffix}`;
  return `${REPOSITORY}/blob/main/content/${path}${suffix}`;
}
