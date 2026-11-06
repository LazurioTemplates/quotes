# Quotes — pravidla pro agenty

Modul `quotes` Organizace `replace-with-org-slug`. Vznikl příkazem
`lazurio module create` (stack `vite-react`) a od prvního commitu splňuje
Lazurio Module Standard. Tak ho drž.

## Scope

- Tento repozitář je jeden Modul: `lazurio.module.json` v kořeni; App, pokud
  ji Modul má, žije v `app/v<N>/`.
- Slot, Teamy a přístupy drží `modules.manifest.json` root repa Organizace.
  Jejich změna jde samostatným PR do root repa Organizace, ne sem.
- Jeden Modul = jeden task worktree = jedna branch = jeden PR. Primární
  checkout zůstává na `main`.

## Standard

- `dev` spouští jeden proces serveru a nic jiného; build, data a migrace
  patří do přípravy (`prepare:app`), kontrola připravenosti do
  `check:prepared`.
- Host a port čte App jen z `LAZURIO_RUNTIME_LISTENER_<ID>_HOST` a `_PORT`
  (přes `@lazurio/module-kit`); bez nich skončí kódem 2. Port patří jen do
  `lazurio.module.json`, do zdrojů App se nepíše.
- Žádné `.env*` soubory, tajemství v repozitáři ani importy mimo tento
  repozitář; sdílený kód jen jako verzovaná závislost.
- Odchylka se opravuje v Modulu, ne výjimkou v Launchpadu.

## Ověření před PR

```sh
lazurio module setup <cesta k Modulu> --root <Lazurio root> --json
```

Očekávaný stav je `current`. Příkazy App (`check`, `test`, ruční start)
popisuje `README.md`.

## Data

Data Modulu žijí v repository-db: složka `db/` je samostatný repozitář
`quotes-data` (větev `v3`, kanonické YAML v `db/data/`), který Git tohoto
Modulu ignoruje. App k nim přistupuje přes `@lazurio/repository-db` (jedna
vydaná verze v `app/v3/package.json`), nikdy přímo přes Git. Commit a push
dat do `v3` je Publikace: dělá ji tlačítko „Publikovat změny“ nebo
`repository-db publish` na pokyn uživatele.

Tvar záznamů popisují jen schémata Zodu: typy se z nich odvozují
(`z.infer`) a JSON Schema se z nich generuje, ručně psané typy dat ani
druhé schéma se nepíšou (profil `app-data`,
https://github.com/Lazurio/LazurioPlatform/blob/main/docs/stack-profiles.md#app-data).

Každá kolekce má schéma v `app/v3/src/domain/collections.ts` dřív
než první záznam a App předává stejná schémata repository-db jako parsery.
`bun run check` ověří záznamy, které nese tento repozitář
(`app/v3/seed/`, rozložené jako `db/data/`); záznamy v `db/`
CI nevidí, proto je před Publikací ověř `bun run validate:db`.
