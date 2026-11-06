import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { routeOf } from "./lib/routes";

// Every Markdown file of content/ is a page of the viewer. Its id is its route
// (see lib/routes.ts); the front matter is shared by every layer, and examples
// add `source`, `date`, `notes` and the route of their rendered `screen`.
const docs = defineCollection({
  loader: glob({
    pattern: "**/*.md",
    base: "../../content",
    generateId: ({ entry }) => routeOf(entry),
  }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    order: z.number().optional(),
    category: z.string().optional(),
    source: z.string().optional(),
    date: z.coerce.date().optional(),
    notes: z.string().optional(),
    screen: z.string().optional(),
  }),
});

export const collections = { docs };
