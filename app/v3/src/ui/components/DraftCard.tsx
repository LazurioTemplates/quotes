import {
  type DraftPanelAction,
  type DraftPanelInput,
  type DraftPanelModel,
  type DraftPanelRecord,
  deriveDraftPanel,
} from "@lazurio/repository-db";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "../../i18n/locale.ts";
import { useLocale, useT } from "../i18n.tsx";

/**
 * The Draft & Publish card, derived by the engine (`deriveDraftPanel`, as
 * repository-db's app contract allows) and drawn with the classes of
 * `DraftPublishPanel` (`rdb-draft-*`). repository-db v3.2.6 words its card in
 * Czech only, so in English the card takes this file's words for the same
 * states, actions and refusals; in Czech it shows the engine's own words.
 * When the engine speaks English (Lazurio/repository-db#40), this file
 * returns to `DraftPublishPanel`.
 */
export interface DraftCardApi {
  loadReview(): Promise<DraftPanelInput>;
  publish(expectedRevision: string): Promise<void>;
  discard(
    scope: { kind: "draft" } | { kind: "record"; path: string },
    expectedRevision: string,
  ): Promise<void>;
  finishSend(expectedHead: string | undefined): Promise<void>;
  pull(): Promise<void>;
}

const EN_ACTIONS: Record<DraftPanelAction["kind"], string> = {
  publish: "Publish all",
  discard_draft: "Discard all",
  finish_send: "Finish sending",
  pull: "Take newer data",
  abort_conflict: "Cancel sending, keep the changes as a draft",
  mark_conflict_resolved: "Mark as resolved",
};

const EN_CHANGES: Record<string, string> = {
  Nový: "New",
  Upraveno: "Changed",
  Smazáno: "Deleted",
  Změna: "Change",
};

const EN_ORIGINS: Record<string, string> = {
  app: "In the app",
  agent: "Agent",
  unknown: "Unknown origin",
};

/** The engine's model in English: the same state, actions and records. */
export function englishModel(model: DraftPanelModel): DraftPanelModel {
  const count = model.count;
  const pill: Record<DraftPanelModel["tone"], string> = {
    unavailable: "Data unavailable",
    conflict: "Conflict",
    sending: "Waiting to be sent",
    draft: "Draft",
    remote: "Newer data",
    published: "Published",
  };
  const headline: Record<DraftPanelModel["tone"], string> = {
    unavailable: "The data checkout is not available yet.",
    conflict:
      "The data split from the server. The changes stay visible, but nothing can be published or returned now.",
    sending:
      count > 0
        ? `A publish of ${count === 1 ? "one change" : `${count} changes`} is saved but did not reach the server. Finish sending it.`
        : "A publish is saved but did not reach the server. Finish sending it.",
    draft:
      count === 1 ? "One change waits to be published." : `${count} changes wait to be published.`,
    remote: "A colleague published newer data.",
    published: "Everything is published. Nothing waits to be sent.",
  };
  const reason = (action: DraftPanelAction): string | undefined => {
    if (action.enabled || !action.disabledReason) return undefined;
    if (action.kind === "publish" && model.tone === "conflict")
      return "Resolve the conflict first.";
    if (action.kind === "discard_draft" && model.tone === "sending") {
      return "The publish is saved already. Finish it first; returning it is not the same as discarding a draft.";
    }
    if (action.kind === "discard_draft") {
      return "Finish sending the saved publish first; until then the last published version is not here.";
    }
    if (action.kind === "finish_send")
      return "The waiting publish is unknown. Reload the overview.";
    return "Not available now.";
  };
  return {
    ...model,
    pill: pill[model.tone],
    headline: headline[model.tone],
    wholeDraftNote:
      model.tone === "draft"
        ? "Everything in the draft is published at once, also changes someone else added."
        : model.wholeDraftNote
          ? "Further records wait for this conflict to be resolved; they are no further conflicts."
          : undefined,
    ownerNote: model.ownerNote?.replace(/^Rozpracované změny začal:/, "Draft started by:"),
    records: model.records.map((record) => ({
      ...record,
      changeLabel: EN_CHANGES[record.changeLabel] ?? record.changeLabel,
      originLabel: EN_ORIGINS[record.originKind] ?? record.originLabel,
      revertBlockedReason: record.revertBlockedReason
        ? model.tone === "conflict"
          ? "Nothing can be returned during a conflict."
          : "Finish sending the saved publish first."
        : undefined,
    })),
    actions: model.actions.map((action) => ({
      ...action,
      label:
        action.kind === "finish_send" && model.tone === "conflict"
          ? "Try to merge safely and send"
          : EN_ACTIONS[action.kind],
      disabledReason: reason(action),
    })),
  };
}

function words(locale: Locale) {
  const en = locale === "en";
  return {
    region: en ? "Draft changes and publishing" : "Rozpracované změny a publikace",
    origin: en ? "Where the change came from" : "Odkud změna přišla",
    revert: en ? "Return the change" : "Vrátit změnu",
    technical: en ? "Technical detail" : "Technický detail",
    hideTechnical: en ? "Hide detail" : "Skrýt detail",
    handoff: en ? "Details for resolving it" : "Podrobnosti pro vyřešení",
    changed: en
      ? "The draft changed meanwhile. Nothing was done; look at it again."
      : "Mezitím se rozpracované změny změnily. Nic jsme neprovedli — zkontrolujte je znovu.",
    confirmRevert: (label: string) =>
      en
        ? `Return the record "${label}" to its published version?`
        : `Vrátit změnu záznamu "${label}" na publikovanou verzi?`,
    reverted: (label: string) =>
      en ? `The change of "${label}" was returned.` : `Změna záznamu "${label}" byla vrácena.`,
    confirmDiscard: (count: number) =>
      en
        ? `Discard every draft change (${count})? The last published version returns.`
        : `Zahodit všechny rozpracované změny (${count})? Vrátí se poslední publikovaná verze.`,
    discarded: en ? "The draft changes were discarded." : "Rozpracované změny byly zahozené.",
    published: en ? "Published." : "Publikováno.",
    sent: en ? "Sent." : "Odesláno.",
    pulled: en ? "Taken." : "Staženo.",
  };
}

function RecordRow({
  record,
  busy,
  onRevert,
}: {
  record: DraftPanelRecord;
  busy: boolean;
  onRevert(record: DraftPanelRecord): void;
}) {
  const locale = useLocale();
  const w = words(locale);
  const [showTechnical, setShowTechnical] = useState(false);
  return (
    <li className={`rdb-draft-record rdb-draft-origin-${record.originKind}`}>
      <div className="rdb-draft-record-head">
        <span className="rdb-draft-chip">{record.changeLabel}</span>
        <span className="rdb-draft-type">{record.typeLabel}</span>
        <strong className="rdb-draft-label">{record.label}</strong>
        <span className="rdb-draft-origin" title={w.origin}>
          {record.originLabel}
        </span>
      </div>
      <p className="rdb-draft-summary">{record.summary}</p>
      {record.fields.length > 0 ? (
        <ul className="rdb-draft-fields">
          {record.fields.map((field) => (
            <li key={`${field.fieldPath}:${field.label}:${field.after}`}>
              <span className="rdb-draft-field-label">{field.label}</span>
              <span className="rdb-draft-before">{field.before}</span>
              <span className="rdb-draft-arrow" aria-hidden="true">
                →
              </span>
              <span className="rdb-draft-after">{field.after}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="rdb-draft-record-actions">
        {record.href ? (
          <button type="button" onClick={() => window.location.assign(record.href as string)}>
            {record.openLabel}
          </button>
        ) : null}
        {record.revertSupported ? (
          <button
            type="button"
            className="rdb-draft-revert"
            disabled={busy}
            onClick={() => onRevert(record)}
          >
            {w.revert}
          </button>
        ) : (
          <span className="rdb-draft-revert-blocked">{record.revertBlockedReason}</span>
        )}
        <button
          type="button"
          className="rdb-draft-technical-toggle"
          onClick={() => setShowTechnical((value) => !value)}
        >
          {showTechnical ? w.hideTechnical : w.technical}
        </button>
      </div>
      {showTechnical ? <code className="rdb-draft-technical">{record.technicalPath}</code> : null}
    </li>
  );
}

export function DraftCard({
  api,
  subscribe,
  pollIntervalMs = 60_000,
}: {
  api: DraftCardApi;
  subscribe?: (onChange: () => void) => () => void;
  pollIntervalMs?: number;
}) {
  const locale = useLocale();
  const t = useT();
  const w = words(locale);
  const [input, setInput] = useState<DraftPanelInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const latest = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++latest.current;
    try {
      const next = await api.loadReview();
      if (request === latest.current) setInput(next);
    } catch {
      if (request === latest.current) setInput(null);
    }
  }, [api]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), pollIntervalMs);
    const unsubscribe = subscribe?.(() => void refresh());
    return () => {
      clearInterval(timer);
      unsubscribe?.();
    };
  }, [refresh, pollIntervalMs, subscribe]);

  const model = useMemo(() => {
    if (!input) return null;
    const derived = deriveDraftPanel(input, {
      finishSend: true,
      pull: true,
      abortConflict: false,
      markConflictResolved: false,
    });
    return locale === "en" ? englishModel(derived) : derived;
  }, [input, locale]);

  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ text: success, tone: "info" });
    } catch (error) {
      const code = (error as { code?: string })?.code;
      setMessage({
        text:
          code === "draft_changed"
            ? w.changed
            : error instanceof Error
              ? error.message
              : String(error),
        tone: "error",
      });
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  if (!model) return <p className="muted">{t("Načítám koncept…", "Loading the draft…")}</p>;
  if (!model.visible) {
    return (
      <div className="rdb-draft-card rdb-draft-unavailable">
        <div className="rdb-draft-body">
          <p className="rdb-draft-headline">{model.headline}</p>
        </div>
      </div>
    );
  }

  const revert = (record: DraftPanelRecord) => {
    if (!window.confirm(w.confirmRevert(record.label))) return;
    void run(
      () => api.discard({ kind: "record", path: record.technicalPath }, model.revision),
      w.reverted(record.label),
    );
  };
  const act = (kind: DraftPanelAction["kind"]) => {
    if (kind === "publish") void run(() => api.publish(model.revision), w.published);
    if (kind === "discard_draft" && window.confirm(w.confirmDiscard(model.count))) {
      void run(() => api.discard({ kind: "draft" }, model.revision), w.discarded);
    }
    if (kind === "finish_send") void run(() => api.finishSend(model.pendingHead), w.sent);
    if (kind === "pull") void run(() => api.pull(), w.pulled);
  };

  return (
    <section
      className={`rdb-draft-card rdb-draft-${model.tone} rdb-draft-open`}
      aria-label={w.region}
    >
      <div className={`rdb-draft-pill rdb-draft-tone-${model.tone}`}>
        <span className="rdb-draft-dot" aria-hidden="true" />
        <span>{model.pill}</span>
        {model.count > 0 ? <span className="rdb-draft-count">{model.count}</span> : null}
      </div>
      <div className="rdb-draft-body">
        <p className="rdb-draft-headline">{model.headline}</p>
        {model.wholeDraftNote ? <p className="rdb-draft-note">{model.wholeDraftNote}</p> : null}
        {model.ownerNote ? <p className="rdb-draft-owner">{model.ownerNote}</p> : null}
        {model.conflict?.handoff ? (
          <details className="rdb-draft-handoff">
            <summary>{w.handoff}</summary>
            <pre>{model.conflict.handoff}</pre>
          </details>
        ) : null}
        {message ? (
          <p className={`rdb-draft-message rdb-draft-message-${message.tone}`} role="status">
            {message.text}
          </p>
        ) : null}
        {model.records.length > 0 ? (
          <ul className="rdb-draft-records">
            {model.records.map((record) => (
              <RecordRow key={record.id} record={record} busy={busy} onRevert={revert} />
            ))}
          </ul>
        ) : null}
        <div className="rdb-draft-actions">
          {model.actions.map((action) => (
            <span key={action.kind} className="rdb-draft-action">
              <button
                type="button"
                className={action.destructive ? "rdb-draft-destructive" : undefined}
                disabled={!action.enabled || busy}
                onClick={() => act(action.kind)}
              >
                {action.label}
              </button>
              {!action.enabled && action.disabledReason ? (
                <small className="rdb-draft-disabled-reason">{action.disabledReason}</small>
              ) : null}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
