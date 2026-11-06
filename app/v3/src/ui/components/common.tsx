import type { ReactNode } from "react";
import { STATUS_LABELS, type QuoteStatus } from "../../domain/quote.ts";
import { ApiError } from "../api.ts";

export function StatusChip({ status }: { status: QuoteStatus }) {
  return <span className={`chip chip-${status}`}>{STATUS_LABELS[status]}</span>;
}

export function Field({
  label,
  hint,
  error,
  children,
  wide,
}: {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is the child
    <label className={`field${error ? " field-invalid" : ""}${wide ? " field-wide" : ""}`}>
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : null}
      {hint && !error ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

/** A refusal of the API in words, with the fields it names. */
export function ErrorNotice({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  const issues = error instanceof ApiError ? error.issues : [];
  return (
    <div className="notice notice-danger" role="alert">
      <strong>Neuloženo.</strong> {message}
      {issues.length > 0 ? (
        <ul className="issues">
          {issues.map((issue) => (
            <li key={`${issue.path}:${issue.message}`}>
              <code>{issue.path}</code> {issue.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Errors of an API refusal by field path, for the form that sent it. */
export function fieldErrors(error: unknown): Record<string, string> {
  const errors: Record<string, string> = {};
  if (error instanceof ApiError) {
    for (const issue of error.issues) errors[issue.path] ??= issue.message;
  }
  return errors;
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="title-row">
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1 className="page-title">{title}</h1>
        </div>
        {actions ? <div className="actions">{actions}</div> : null}
      </div>
      {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
    </header>
  );
}
