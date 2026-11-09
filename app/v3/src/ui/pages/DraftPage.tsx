import { useEffect, useMemo, useState } from "react";
import type { RuleIssue } from "../../domain/rules.ts";
import { api, subscribe } from "../api.ts";
import { PageHeader } from "../components/common.tsx";
import { DraftCard, type DraftCardApi } from "../components/DraftCard.tsx";
import { useT } from "../i18n.tsx";

/**
 * Draft & Publish: the card shows what changed, publishes it as one change or
 * returns it. The App adds only the data check.
 */
export function DraftPage({ onChanged }: { onChanged: () => Promise<void> }) {
  const t = useT();
  const [issues, setIssues] = useState<RuleIssue[] | null>(null);

  useEffect(() => {
    const load = () => {
      api.check().then(setIssues, () => setIssues(null));
    };
    load();
    return subscribe(load);
  }, []);

  const cardApi: DraftCardApi = useMemo(
    () => ({
      loadReview: () => api.draft(),
      publish: async (expectedRevision) => {
        await api.publish(expectedRevision);
        await onChanged();
      },
      discard: async (scope, expectedRevision) => {
        await api.discard(scope, expectedRevision);
        await onChanged();
      },
      finishSend: async (expectedHead) => {
        await api.finishSend(expectedHead ?? "");
        await onChanged();
      },
      pull: async () => {
        await api.pull();
        await onChanged();
      },
    }),
    [onChanged],
  );

  return (
    <section>
      <PageHeader
        title={t("Koncept a publikování", "Draft & publish")}
        subtitle={t(
          "Uložené úpravy jsou koncept. Publikováním je jedním krokem odešlete do datového repozitáře Organizace, kde je uvidí kolegové i jejich agenti. Zákazníkovi se tím nic neposílá.",
          "Saved edits are a draft. Publishing sends them in one step to the Organization's data repository, where colleagues and their agents see them. Nothing goes to a customer.",
        )}
      />
      <div className="draft-panel">
        <DraftCard api={cardApi} subscribe={(onChange) => subscribe(() => onChange())} />
      </div>
      <article className="ds-card">
        <h2>{t("Kontrola dat", "Data check")}</h2>
        {issues === null ? (
          <p className="muted">{t("Kontrolu teď nejde spustit.", "The check cannot run now.")}</p>
        ) : issues.length === 0 ? (
          <p className="ok">
            {t(
              "Všechny záznamy odpovídají schématům a pravidlům.",
              "Every record matches its schema and the rules.",
            )}
          </p>
        ) : (
          <ul className="issues">
            {issues.map((issue) => (
              <li key={`${issue.record}:${issue.message}`}>
                <code>{issue.record}</code> {issue.message}
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}
