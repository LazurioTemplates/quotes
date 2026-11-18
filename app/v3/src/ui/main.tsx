import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// The design system first: tokens, fonts, base styles and its components;
// then the App's own layout, then the Organization's overlay.
import "design-system/styles.css";
import "./styles.css";
import "../instance/theme.css";
import { App } from "./App.tsx";
import { api, setApiLocale } from "./api.ts";
import { LocaleContext } from "./i18n.tsx";
import { resolveLocale } from "./locale.ts";
import { quoteTools, registerTools } from "./tools.ts";
import { WriteContext } from "./write.tsx";

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root");
void resolveLocale().then(async (locale) => {
  document.documentElement.lang = locale;
  document.title = locale === "en" ? "Quotes" : "Cenové nabídky";
  setApiLocale(locale);
  // The one writer rule for this visitor, once: the page and its tools offer
  // changes only when the server says this copy writes for them.
  const status = await api.status().catch(() => null);
  const canWrite = status ? status.mayWrite === true : null;
  registerTools(quoteTools(api, locale, { canWrite: canWrite === true }));
  createRoot(root).render(
    <StrictMode>
      <LocaleContext.Provider value={locale}>
        <WriteContext.Provider value={canWrite}>
          <App />
        </WriteContext.Provider>
      </LocaleContext.Provider>
    </StrictMode>,
  );
});
