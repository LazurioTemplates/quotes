/**
 * The stylesheet of the quote document, on paper and on screen. It reads only
 * the `--ds-*` custom properties of the design system (`theme.ts`); a colour
 * of its own, or a name the design system does not define, fails
 * `tests/document.test.ts`. Page size and margins are in millimetres, because
 * paper is.
 */
const type = (role: string) =>
  `font: var(--ds-type-${role}-weight) var(--ds-type-${role}-size) / var(--ds-type-${role}-leading) var(--ds-type-${role}-font); letter-spacing: var(--ds-type-${role}-tracking);`;
const caps = `${type("status")} text-transform: uppercase; letter-spacing: 0.03em; color: var(--ds-color-ink-muted);`;

export const documentCss = `
@page { size: A4; margin: 14mm 14mm 16mm; }
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--ds-color-surface-muted); color: var(--ds-color-ink); }
body { ${type("meta")} padding: var(--ds-space-32) var(--ds-space-16); }
.toolbar { display: flex; flex-wrap: wrap; gap: var(--ds-space-12); align-items: center; justify-content: space-between; max-width: 210mm; margin: 0 auto var(--ds-space-16); }
.toolbar a { color: var(--ds-color-ink); text-decoration-color: var(--ds-color-accent); }
.toolbar button { ${type("label")} padding: var(--ds-space-8) var(--ds-space-16); border: 0; border-radius: var(--ds-radius-sm); background: var(--ds-color-action); color: var(--ds-color-on-action); cursor: pointer; }
.toolbar .hint { color: var(--ds-color-ink-muted); }
.toolbar .draft { padding: 0 var(--ds-space-8); border-radius: var(--ds-radius-xs); background: var(--ds-color-warning-soft); color: var(--ds-color-warning); }
.doc { max-width: 210mm; min-height: 297mm; margin: 0 auto; padding: 16mm 15mm; background: var(--ds-color-surface); border: var(--ds-size-border) solid var(--ds-color-line); }
.doc h1, .doc h2, .doc h3, .doc p { margin: 0; }
.doc-head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--ds-space-24); padding-bottom: var(--ds-space-16); border-bottom: var(--ds-size-indicator) solid var(--ds-color-accent); }
.doc-brand { display: flex; align-items: center; gap: var(--ds-space-8); ${type("title")} }
.doc-dot { width: var(--ds-space-12); height: var(--ds-space-12); border-radius: var(--ds-radius-pill); background: var(--ds-color-accent); }
.doc-title { text-align: right; }
.doc-eyebrow { ${caps} }
.doc-number { ${type("title")} }
.doc-version { color: var(--ds-color-ink-muted); }
.doc-parties { display: grid; grid-template-columns: 1fr 1fr auto; gap: var(--ds-space-24); padding: var(--ds-space-12) 0; border-bottom: var(--ds-size-border) solid var(--ds-color-line); }
.doc-parties h2 { ${caps} margin-bottom: var(--ds-space-4); }
.doc-party-name { font-weight: var(--ds-type-label-weight); }
.doc-meta { display: grid; grid-template-columns: auto 1fr; align-content: start; gap: var(--ds-space-4) var(--ds-space-12); margin: 0; }
.doc-meta dt { color: var(--ds-color-ink-muted); }
.doc-meta dd { margin: 0; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.doc-subject { ${type("title")} margin-top: var(--ds-space-16) !important; }
.doc-intro { margin-top: var(--ds-space-8) !important; color: var(--ds-color-ink-muted); max-width: 150mm; }
.doc-table { width: 100%; border-collapse: collapse; margin-top: var(--ds-space-16); font-variant-numeric: tabular-nums; }
.doc-table th { ${caps} text-align: left; white-space: nowrap; padding: var(--ds-space-8) var(--ds-space-8) var(--ds-space-4); border-bottom: var(--ds-size-border) solid var(--ds-color-line-strong); }
.doc-table td { padding: var(--ds-space-4) var(--ds-space-8); border-bottom: var(--ds-size-border) solid var(--ds-color-line); vertical-align: top; }
.doc-table tbody tr { break-inside: avoid; }
.doc-table .num { text-align: right; white-space: nowrap; }
.doc-table .pos { color: var(--ds-color-ink-muted); width: 2em; }
.doc-table:not(.doc-vat) td:nth-child(2) { width: 40%; }
.doc-line-name { font-weight: var(--ds-type-label-weight); }
.doc-line-detail { color: var(--ds-color-ink-muted); }
.doc-summary { display: grid; grid-template-columns: minmax(0, 1fr) max-content; gap: var(--ds-space-32); margin-top: var(--ds-space-16); break-inside: avoid; }
.doc-vat { margin-top: 0; }
.doc-vat th, .doc-vat td { padding: var(--ds-space-4) var(--ds-space-8); }
.doc-vat td { white-space: nowrap; }
.doc-sum { margin: 0; display: grid; grid-template-columns: 1fr auto; gap: var(--ds-space-4) var(--ds-space-16); font-variant-numeric: tabular-nums; }
.doc-sum dt { color: var(--ds-color-ink-muted); white-space: nowrap; }
.doc-sum dd { margin: 0; text-align: right; white-space: nowrap; }
.doc-sum .doc-payable { padding-top: var(--ds-space-8); margin-top: var(--ds-space-4); border-top: var(--ds-size-indicator) solid var(--ds-color-ink); ${type("title")} color: var(--ds-color-ink); }
.doc-terms { margin-top: var(--ds-space-24); padding-top: var(--ds-space-12); border-top: var(--ds-size-border) solid var(--ds-color-line); break-inside: avoid; }
.doc-terms h2 { ${caps} margin-bottom: var(--ds-space-4); }
.doc-terms p { white-space: pre-line; }
.doc-foot { break-before: avoid; break-inside: avoid; margin-top: var(--ds-space-20); padding-top: var(--ds-space-8); border-top: var(--ds-size-border) solid var(--ds-color-line); ${type("status")} font-weight: 400; color: var(--ds-color-ink-muted); display: flex; flex-wrap: wrap; gap: var(--ds-space-4) var(--ds-space-16); }
@media print {
  html, body { background: var(--ds-color-surface); padding: 0; }
  .toolbar { display: none; }
  .doc { max-width: none; min-height: 0; margin: 0; padding: 0; border: 0; }
}
`;
