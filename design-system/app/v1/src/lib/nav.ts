import { type CollectionEntry, getCollection } from "astro:content";
import { hrefOf } from "./routes";

export type NavItem = { label: string; href: string };
export type NavGroup = { title: string; href: string; items: NavItem[] };

// The layers of the design system in the order a reader needs them. `section`
// is the folder under content/; `extra` are viewer pages that belong to it.
const LAYERS: { section: string; title: string; extra: NavItem[] }[] = [
  {
    section: "brand",
    title: "Foundations",
    extra: [{ label: "Tokens (rendered)", href: "/foundations/tokens/" }],
  },
  {
    section: "components",
    title: "Components",
    extra: [{ label: "Gallery", href: "/components/gallery/" }],
  },
  { section: "patterns", title: "Patterns", extra: [] },
  { section: "writing", title: "Writing", extra: [] },
  { section: "templates", title: "Templates", extra: [] },
  { section: "examples", title: "Examples", extra: [] },
];

export const SCREENS: NavItem[] = [
  { label: "Experiments", href: "/screens/experiments/" },
  { label: "New experiment", href: "/screens/new-experiment/" },
  { label: "Stop or scale decision", href: "/screens/stop-or-scale/" },
  { label: "Research sources", href: "/screens/research-sources/" },
  { label: "Experiment update e-mail", href: "/screens/experiment-update-email/" },
];

export function sectionOf(entry: CollectionEntry<"docs">): string {
  return entry.id.split("/")[0] ?? "";
}

function byOrder(a: CollectionEntry<"docs">, b: CollectionEntry<"docs">): number {
  return (a.data.order ?? 999) - (b.data.order ?? 999) || a.data.title.localeCompare(b.data.title);
}

export async function navigation(): Promise<NavGroup[]> {
  const docs = (await getCollection("docs")).sort(byOrder);
  const groups: NavGroup[] = LAYERS.map(({ section, title, extra }) => {
    const entries = docs.filter((d) => sectionOf(d) === section && d.id !== section);
    return {
      title,
      href: hrefOf(section),
      items: [
        ...entries.map((d) => ({
          label: d.data.title.replace(/^(Template|Screen): /, ""),
          href: hrefOf(d.id),
        })),
        ...extra,
      ],
    };
  });
  groups.push({ title: "Screens", href: "/examples/", items: SCREENS });
  return groups;
}

export async function sectionEntries(section: string): Promise<CollectionEntry<"docs">[]> {
  return (await getCollection("docs"))
    .filter((d) => sectionOf(d) === section && d.id !== section)
    .sort(byOrder);
}
