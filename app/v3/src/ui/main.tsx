import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter-tight";
import "@fontsource/geist-mono/400.css";
import "./styles.css";
import "../instance/theme.css";
import { App } from "./App.tsx";
import { setApiLocale } from "./api.ts";
import { LocaleContext } from "./i18n.tsx";
import { resolveLocale } from "./locale.ts";

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root");
void resolveLocale().then((locale) => {
  document.documentElement.lang = locale;
  document.title = locale === "en" ? "Quotes" : "Cenové nabídky";
  setApiLocale(locale);
  createRoot(root).render(
    <StrictMode>
      <LocaleContext.Provider value={locale}>
        <App />
      </LocaleContext.Provider>
    </StrictMode>,
  );
});
