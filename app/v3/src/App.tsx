import { greeting } from "./greeting.ts";

const TITLE = "Quotes";
const MODULE = "quotes";
const ORGANIZATION = "replace-with-org-slug";

export function App() {
  return (
    <main>
      <h1>{greeting(TITLE)}</h1>
      <p>
        Modul {MODULE} Organizace {ORGANIZATION} běží podle Lazurio Module Standardu.
      </p>
    </main>
  );
}
