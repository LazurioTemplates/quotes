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

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root");
void resolveLocale().then((locale) => {
  document.documentElement.lang = locale;
  document.title = locale === "en" ? "Quotes" : "Cenové nabídky";
  setApiLocale(locale);
  registerTools(quoteTools(api, locale));
  createRoot(root).render(
    <StrictMode>
      <LocaleContext.Provider value={locale}>
        <App />
      </LocaleContext.Provider>
    </StrictMode>,
  );
});
