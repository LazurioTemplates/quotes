/**
 * The stylesheet of the quote document, on paper and on screen. It reads only
 * the roles and scales of the design system (`tokens.ts`); a colour of its own
 * fails `tests/document.test.ts`. Page size and margins are in millimetres,
 * because paper is.
 */
export const documentCss = `
@page { size: A4; margin: 14mm 14mm 16mm; }
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--surface-sunken); color: var(--text); font: var(--type-body-sm); }
body { padding: var(--space-8) var(--space-4); }
.toolbar { display: flex; gap: var(--space-3); align-items: center; justify-content: space-between; max-width: 210mm; margin: 0 auto var(--space-4); font: var(--type-body-sm); }
.toolbar a { color: var(--accent-text); text-decoration: none; }
.toolbar button { font: inherit; font-weight: 600; padding: var(--space-2) var(--space-4); border: var(--stroke-hairline) solid var(--accent); border-radius: var(--radius-md); background: var(--accent); color: var(--surface-raised); cursor: pointer; }
.toolbar .hint { color: var(--text-muted); }
.doc { max-width: 210mm; min-height: 297mm; margin: 0 auto; padding: 16mm 15mm; background: var(--surface-raised); border: var(--stroke-hairline) solid var(--border); }
.doc h1, .doc h2, .doc h3, .doc p { margin: 0; }
.doc-head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-6); padding-bottom: var(--space-5); border-bottom: var(--stroke-edge) solid var(--accent); }
.doc-brand { display: flex; align-items: center; gap: var(--space-2); font: var(--type-h4); }
.doc-dot { width: var(--space-3); height: var(--space-3); border-radius: var(--radius-pill); background: var(--accent); }
.doc-title { text-align: right; }
.doc-eyebrow { font: var(--type-caption); text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); }
.doc-number { font: var(--type-h3); }
.doc-version { color: var(--text-muted); }
.doc-draft { display: inline-block; margin-top: var(--space-1); padding: 0 var(--space-2); border-radius: var(--radius-sm); background: var(--warning-subtle); color: var(--warning); font: var(--type-caption); text-transform: uppercase; letter-spacing: 0.06em; }
.doc-parties { display: grid; grid-template-columns: 1fr 1fr 0.8fr; gap: var(--space-6); padding: var(--space-5) 0; border-bottom: var(--stroke-hairline) solid var(--border); }
.doc-parties h2 { font: var(--type-caption); text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: var(--space-1); }
.doc-party-name { font-weight: 600; }
.doc-lines-of p { line-height: 1.45; }
.doc-meta { display: grid; grid-template-columns: auto 1fr; gap: var(--space-1) var(--space-3); margin: 0; }
.doc-meta dt { color: var(--text-muted); }
.doc-meta dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
.doc-subject { font: var(--type-h3); margin-top: var(--space-6) !important; }
.doc-intro { margin-top: var(--space-2) !important; color: var(--text-muted); max-width: 150mm; }
.doc-table { width: 100%; border-collapse: collapse; margin-top: var(--space-5); font-variant-numeric: tabular-nums; }
.doc-table th { font: var(--type-caption); text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); text-align: left; padding: var(--space-2); border-bottom: var(--stroke-hairline) solid var(--border-strong); }
.doc-table td { padding: var(--space-2); border-bottom: var(--stroke-hairline) solid var(--border); vertical-align: top; }
.doc-table tbody tr { break-inside: avoid; }
.doc-table .num { text-align: right; white-space: nowrap; }
.doc-table .pos { color: var(--text-subtle); width: 2em; }
.doc-line-name { font-weight: 500; }
.doc-line-detail { color: var(--text-muted); }
.doc-summary { display: grid; grid-template-columns: 1fr 0.85fr; gap: var(--space-8); margin-top: var(--space-5); break-inside: avoid; }
.doc-vat th, .doc-vat td { padding: var(--space-1) var(--space-2); }
.doc-sum { margin: 0; display: grid; grid-template-columns: 1fr auto; gap: var(--space-1) var(--space-4); font-variant-numeric: tabular-nums; }
.doc-sum dt { color: var(--text-muted); }
.doc-sum dd { margin: 0; text-align: right; }
.doc-sum .doc-payable { padding-top: var(--space-2); margin-top: var(--space-1); border-top: var(--stroke-focus) solid var(--text); font: var(--type-h4); color: var(--text); }
.doc-terms { margin-top: var(--space-8); padding-top: var(--space-4); border-top: var(--stroke-hairline) solid var(--border); break-inside: avoid; }
.doc-terms h2 { font: var(--type-caption); text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: var(--space-1); }
.doc-terms p { white-space: pre-line; }
.doc-foot { margin-top: var(--space-10); padding-top: var(--space-3); border-top: var(--stroke-hairline) solid var(--border); color: var(--text-subtle); font: var(--type-caption); display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-4); }
@media print {
  html, body { background: var(--surface-raised); padding: 0; }
  .toolbar { display: none; }
  .doc { max-width: none; min-height: 0; margin: 0; padding: 0; border: 0; }
}
`;
