# Contributing to Quotes

Quotes is a template: Organizations adopt a release and take later releases
by merging their tags. A contribution keeps that path working.

1. Read [`AGENTS.md`](AGENTS.md) and [`docs/extending.md`](docs/extending.md).
2. Decide where the change belongs: reusable App code, schemas, skills and
   starts here; an Organization's price list, customers and quotes in its own
   data repository.
3. Write every text people see in Czech and English, side by side
   (`t("Ceník", "Price list")`), and both starts of `app/v3/seed/`.
4. Work in a branch, run `bun run check` and `bun run build` in `app/v3`,
   and open a pull request with a `CHANGELOG.md` entry.
5. Keep data fictional and the license notices intact. Contributions are
   licensed under MIT, like the repository.

A change of a record schema is a change of the data contract: say in the pull
request how existing data repositories stay valid, or ship the migration.
