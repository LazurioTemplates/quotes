import { cx, fieldIds, type Tone } from "design-system";
import { Alert, Badge, Icon } from "design-system/react";
import { cloneElement, isValidElement, type ReactElement, type ReactNode, useId } from "react";
import { type QuoteStatus, STATUS_LABELS } from "../../domain/quote.ts";
import { ApiError } from "../api.ts";
import { useLocale, useT } from "../i18n.tsx";

/** The design system's tone of each state of a quote. */
export const STATUS_TONES: Record<QuoteStatus, Tone> = {
  draft: "neutral",
  sent: "info",
  accepted: "success",
  rejected: "danger",
  expired: "warning",
};

export function StatusChip({ status }: { status: QuoteStatus }) {
  const t = useT();
  return <Badge tone={STATUS_TONES[status]}>{t.of(STATUS_LABELS[status])}</Badge>;
}

const CONTROL_CLASS: Record<string, string> = {
  input: "ds-input",
  select: "ds-select",
  textarea: "ds-textarea",
};

/**
 * A field of a form in the design system's markup (`ds-field`): its label,
 * hint and error point at the control. The control is the child element, an
 * `<input>`, `<select>` or `<textarea>` the page controls itself; the field
 * gives it the design system's class and the ids.
 */
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
  const id = useId();
  const ids = fieldIds(id, hint, error);
  const control = isValidElement(children)
    ? (children as ReactElement<Record<string, unknown>>)
    : null;
  const kind =
    control && typeof control.type === "string" ? CONTROL_CLASS[control.type] : undefined;
  const rendered =
    control && kind
      ? cloneElement(control, {
          id,
          className: cx(kind, control.props.className as string | undefined),
          "aria-invalid": error ? "true" : undefined,
          "aria-describedby": ids.describedBy,
        })
      : children;
  return (
    <div className={cx("ds-field", wide && "field-wide")}>
      {kind ? (
        <label className="ds-field__label" htmlFor={id}>
          {label}
        </label>
      ) : (
        <span className="ds-field__label">{label}</span>
      )}
      {hint ? (
        <p className="ds-field__hint" id={ids.hintId}>
          {hint}
        </p>
      ) : null}
      {kind === "ds-select" ? (
        <div className="ds-select-wrap">
          {rendered}
          <Icon name="nav-arrow-down" className="ds-select__chevron" />
        </div>
      ) : (
        rendered
      )}
      {error ? (
        <p className="ds-field__error" id={ids.errorId}>
          <Icon name="warning-circle" size="sm" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A refusal of the API in words, with the fields it names. */
export function ErrorNotice({ error }: { error: unknown }) {
  const t = useT();
  const locale = useLocale();
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  const issues = error instanceof ApiError ? error.issues : [];
  return (
    <Alert tone="danger" title={t("Neuloženo.", "Not saved.")} live="assertive" locale={locale}>
      <p>{message}</p>
      {issues.length > 0 ? (
        <ul className="issues">
          {issues.map((issue) => (
            <li key={`${issue.path}:${issue.message}`}>
              <code>{issue.path}</code> {issue.message}
            </li>
          ))}
        </ul>
      ) : null}
    </Alert>
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
