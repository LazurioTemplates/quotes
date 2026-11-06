# Quotes

Modul `quotes` Organizace `replace-with-org-slug`: UI a datová aplikace
ve Vite + React + TypeScript strict. Vznikl příkazem
`lazurio module create --stack vite-react` a splňuje Lazurio Module Standard.

## Struktura

- `lazurio.module.json` — identita Modulu, lease `main` z poolu Organizace,
  `apps[]` a `default_app`.
- `app/v3/` — App; `package.json` nese `lazurio.runtime` (listener
  `app`, health `/`) a `lazurio.preparation`.
- `.github/workflows/check.yml` — CI: `bun install --frozen-lockfile`,
  `bun run check` (typová kontrola, Biome a testy).

## Stack

Modul vznikl podle stack profilu
[`app-data` 2026.11](https://github.com/Lazurio/LazurioPlatform/blob/main/docs/stack-profiles.md#app-data): přesné
verze Bunu, TypeScriptu, Biome a frameworku v `app/v3/package.json` jsou jeho.
Mění se jen řízeně: novým vydáním profilu, které Modul převezme vlastním PR,
nebo přechodem na další generaci `app/v<N>`.

## Vývoj

```sh
cd app/v3
bun install --frozen-lockfile
bun run check   # tsc --noEmit, biome, jednotkové testy a start kontrakt
```

Start patří Launchpadu: `lazurio module start replace-with-org-slug/quotes --json`
a otevři `result.runtime.url`. Ruční start jen s listener proměnnými (port je
lease `main` v `lazurio.module.json`):

```sh
LAZURIO_RUNTIME_LISTENER_APP_HOST=127.0.0.1 LAZURIO_RUNTIME_LISTENER_APP_PORT=<port> bun run dev
```

## Příprava

- `check:prepared` ověří, že jsou nainstalované závislosti; Vite dev server
  build nepotřebuje, proto App nedeklaruje `prepare_script`.
- `dev` spouští jeden proces Vite dev serveru. Build, data ani migrace do něj
  nepatří.
- Z `main` Launchpad App otevírá jako její sestavenou verzi: `bun run build`
  zapíše `dist/` (`build_output`) a Platforma ho servíruje sama; neznámá cesta
  bez přípony dostane `index.html` (`static_fallback: "spa"`).
