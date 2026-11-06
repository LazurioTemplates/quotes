/**
 * The look of the quote document comes from the design system this Module
 * carries in `design-system/` at its root: a subtree merge of a release of
 * LazurioTemplates/design-system (v1.0.0), never a copy. Its own `tokens.ts`
 * reads its own `tokens.json` and writes the CSS custom properties; the
 * document's stylesheet (`document-css.ts`) uses only those names. A newer
 * design system arrives as a merge of its tag (docs/extending.md, "The look
 * of the quote document"), and this file is the one place that names it.
 */
import { tokenStylesheet, tokens } from "../../../../design-system/app/v1/src/tokens.ts";

export const designTokens = tokens;

/** The design system's tokens as CSS, light and dark; the document pins light with `data-theme`. */
export function designSystemStylesheet(): string {
  return tokenStylesheet(tokens);
}
