// `bun run quotes <command>`: the agent's way into the Module's data, the
// steps of the skills in .agents/skills/. Every command goes through the same
// storage port and service as the App; a write is a draft that a person
// reviews and publishes in the App ("Koncept a publikování"), never a
// publish, and nothing is ever sent to a customer.
import { readFileSync } from "node:fs";
import { z } from "zod";
import dataRepository from "../../config/data-repository.json";
import { readDataDirectory } from "../data/directory.ts";
import { createMemoryStore } from "../data/memory-store.ts";
import { createRepositoryDbStore } from "../data/repository-db-store.ts";
import { type QuotesStore, StoreError } from "../data/store.ts";
import { calculateQuote } from "../domain/calculate.ts";
import { customer } from "../domain/customer.ts";
import { formatMoney, formatNumber, formatPercent, parseMoney, percent } from "../domain/money.ts";
import {
  idOfQuote,
  latestVersions,
  QUOTE_ACTIONS,
  QUOTE_STATUSES,
  type Quote,
  type QuoteAction,
  type QuoteLine,
  STATUS_LABELS,
} from "../domain/quote.ts";
import { vatRateById } from "../domain/settings.ts";
import { type Locale, parseLocale, pick } from "../i18n/locale.ts";
import { createService, type QuotesService } from "../service/quotes-service.ts";
import { DATA_MOUNT, MODULE_ROOT, seedDirectory } from "./paths.ts";

export const USAGE = `Usage: bun run quotes <command> [options]

Commands
  items [--search <text>] [--category <id>]      the price list, or the items that match
  customers [--search <text>]                    the customers
  quotes [--status draft|sent|accepted|rejected|expired]   the latest version of every quote
  quote:new --input <file.json>                  a new draft quote (see docs/agents.md)
  quote:show <number|id>                         a quote with its lines and totals
  quote:check <number|id>                        the check before sending (exit 1 on an error)
  quote:email <number|id>                        the e-mail text and the PDF's file name
  quote:print <number|id>                        the path of the print page (append it to the App's runtime.url)
  quote:act <number|id> send|accept|reject|expire   the quote's next state, saved as a draft
  import:preview --csv <file> --supplier <name> [--valid-from YYYY-MM-DD] [--markup <percent>]
                 [--round-crowns] [--category <id>] [--encoding utf-8|windows-1250]
  import:apply   the same options and [--rows 2,3,7]  writes the chosen rows as a draft
  check                                          the rules across the data (draft included)

Options
  --lang cs|en   the language of the output (default cs; use your Folder's language)
  --json         machine-readable output
  --db <path>    the data checkout (default: the Module's db/)
  --demo         the fictional example data in memory instead of db/; nothing is kept`;

export interface Options {
  command: string;
  args: string[];
  flags: Map<string, string | true>;
}

export function parseArgs(argv: readonly string[]): Options {
  const [command = "help", ...rest] = argv;
  const args: string[] = [];
  const flags = new Map<string, string | true>();
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index] as string;
    if (!value.startsWith("--")) {
      args.push(value);
      continue;
    }
    const name = value.slice(2);
    const next = rest[index + 1];
    if (next !== undefined && !next.startsWith("--") && !BOOLEAN_FLAGS.has(name)) {
      flags.set(name, next);
      index += 1;
    } else flags.set(name, true);
  }
  return { command, args, flags };
}

const BOOLEAN_FLAGS = new Set(["json", "demo", "round-crowns"]);

const lineInput = z.union([
  z.strictObject({
    code: z.string().min(1),
    quantity: z.number().positive(),
    discount_percent: percent.optional(),
    description: z.string().min(1).optional(),
  }),
  z.strictObject({
    name: z.string().min(1),
    quantity: z.number().positive(),
    unit: z.string().min(1).optional(),
    unit_price: z.string().min(1).optional(),
    vat_rate: z.string().min(1).optional(),
    discount_percent: percent.optional(),
    description: z.string().min(1).optional(),
    to_check: z.string().min(1).optional(),
  }),
]);

/** What `quote:new --input` reads; `docs/agents.md` shows an example. */
export const newQuoteFile = z.strictObject({
  customer: z.union([z.string().min(1), customer.omit({ id: true })]),
  title: z.string().min(1),
  lines: z.array(lineInput),
  discount_percent: percent.optional(),
  introduction: z.string().min(1).optional(),
  terms: z.string().min(1).optional(),
  internal_note: z.string().min(1).optional(),
  prepared_by: z.string().min(1).optional(),
});

export interface Context {
  store: QuotesStore;
  service: QuotesService;
  locale: Locale;
  json: boolean;
  out: (text: string) => void;
}

function fail(cs: string, en: string): never {
  throw new StoreError("bad_request", { cs, en });
}

async function quoteOf(context: Context, reference: string | undefined): Promise<Quote> {
  if (!reference) fail("Chybí číslo nabídky.", "The quote number is missing.");
  const found = await context.service.findQuote(reference);
  if (!found) {
    fail(`Nabídka ${reference} neexistuje.`, `The quote ${reference} does not exist.`);
  }
  return found.value;
}

function describeQuote(
  quote: Quote,
  context: Context,
  settings: Parameters<typeof calculateQuote>[1],
) {
  const { locale } = context;
  const t = (cs: string, en: string) => pick(locale, cs, en);
  const money = (amount: number) => formatMoney(amount, quote.currency, locale);
  const totals = calculateQuote(quote, settings);
  const lines = quote.lines.map((line, index) => {
    const amounts = totals.lines[index];
    const code = line.item_code ?? t("mimo ceník", "not in the price list");
    const check = line.to_check ? `  ⚠ ${line.to_check}` : "";
    return `  ${line.id}  ${formatNumber(line.quantity, locale)} ${line.unit}  ${line.name} [${code}]  ${money(line.unit_price)}  ${formatPercent(line.vat_percent, locale)}  = ${money(amounts?.net ?? 0)}${check}`;
  });
  return [
    `${quote.number} v${quote.version} · ${STATUS_LABELS[quote.status][locale]} · ${quote.title}`,
    `${t("Zákazník", "Customer")}: ${quote.customer.name} (${quote.customer.id})`,
    ...lines,
    `${t("Celkem bez DPH", "Total excl. VAT")}: ${money(totals.base)} · ${t("DPH", "VAT")}: ${money(totals.vat)} · ${t("Celkem s DPH", "Total incl. VAT")}: ${money(totals.payable)}`,
    ...(totals.margin
      ? [
          `${t("Marže", "Margin")}: ${money(totals.margin.amount)} (${formatPercent(totals.margin.percent, locale)})`,
        ]
      : []),
  ].join("\n");
}

/** Runs one command; returns the exit code. */
export async function run(options: Options, context: Context): Promise<number> {
  const { store, service, locale, json, out } = context;
  const t = (cs: string, en: string) => pick(locale, cs, en);
  const flag = (name: string) => {
    const value = options.flags.get(name);
    return typeof value === "string" ? value : undefined;
  };
  const print = (value: unknown, text: () => string) =>
    out(json ? JSON.stringify(value, null, 2) : text());

  switch (options.command) {
    case "items": {
      const [items, settings] = await Promise.all([store.listItems(), store.settings()]);
      const search = (flag("search") ?? "").toLowerCase();
      const words = search.split(/\s+/).filter(Boolean);
      const found = items
        .map((entry) => entry.value)
        .filter((item) => !item.archived)
        .filter((item) => !flag("category") || item.category === flag("category"))
        .filter((item) => {
          const haystack =
            `${item.code} ${item.name} ${item.description ?? ""} ${item.supplier ?? ""}`.toLowerCase();
          return words.every((word) => haystack.includes(word));
        });
      print(found, () =>
        found.length === 0
          ? t("Nic nenalezeno.", "Nothing found.")
          : found
              .map((item) => {
                const rate = vatRateById(settings.value, item.vat_rate);
                return `${item.code}  ${item.name}  ${formatMoney(item.sale_price, settings.value.currency, locale)} / ${item.unit}  ${t("DPH", "VAT")} ${rate ? formatPercent(rate.percent, locale) : item.vat_rate}${item.valid_to ? `  ${t("do", "until")} ${item.valid_to}` : ""}`;
              })
              .join("\n"),
      );
      return 0;
    }
    case "customers": {
      const search = (flag("search") ?? "").toLowerCase();
      const found = (await store.listCustomers())
        .map((entry) => entry.value)
        .filter((entry) =>
          `${entry.name} ${entry.company_id ?? ""} ${entry.email ?? ""} ${entry.contact_person ?? ""}`
            .toLowerCase()
            .includes(search),
        );
      print(
        found,
        () =>
          found
            .map(
              (entry) =>
                `${entry.id}  ${entry.name}  ${entry.email ?? ""}  ${entry.company_id ?? ""}`,
            )
            .join("\n") || t("Nic nenalezeno.", "Nothing found."),
      );
      return 0;
    }
    case "quotes": {
      const status = flag("status");
      if (status && !QUOTE_STATUSES.includes(status as Quote["status"])) {
        fail(`Neznámý stav ${status}.`, `Unknown state ${status}.`);
      }
      const [all, settings] = await Promise.all([store.listQuotes(), store.settings()]);
      const found = latestVersions(all.map((entry) => entry.value)).filter(
        (quote) => !status || quote.status === status,
      );
      print(
        found.map((quote) => ({ id: idOfQuote(quote), ...quote })),
        () =>
          found
            .map(
              (quote) =>
                `${quote.number} v${quote.version}  ${STATUS_LABELS[quote.status][locale]}  ${quote.customer.name}  ${quote.title}  ${formatMoney(calculateQuote(quote, settings.value).payable, quote.currency, locale)}  ${t("platí do", "valid until")} ${quote.valid_until}`,
            )
            .join("\n") || t("Nic nenalezeno.", "Nothing found."),
      );
      return 0;
    }
    case "quote:act": {
      const quote = await quoteOf(context, options.args[0]);
      const action = options.args[1] as QuoteAction | undefined;
      if (!action || !QUOTE_ACTIONS.includes(action)) {
        fail(
          `Krok je jeden z: ${QUOTE_ACTIONS.join(", ")}.`,
          `The step is one of: ${QUOTE_ACTIONS.join(", ")}.`,
        );
      }
      const current = await store.getQuote(idOfQuote(quote));
      if (!current) fail("Nabídka zmizela.", "The quote is gone.");
      const saved = await service.act(idOfQuote(quote), action, current.revision);
      print({ id: idOfQuote(saved.value), status: saved.value.status }, () =>
        t(
          `${saved.value.number} v${saved.value.version} je teď „${STATUS_LABELS[saved.value.status].cs}“ (koncept; publikuje ho člověk).`,
          `${saved.value.number} v${saved.value.version} is now “${STATUS_LABELS[saved.value.status].en}” (a draft; a person publishes it).`,
        ),
      );
      return 0;
    }
    case "quote:new": {
      const file = flag("input");
      if (!file) fail("Chybí --input <soubor.json>.", "--input <file.json> is missing.");
      const parsed = newQuoteFile.safeParse(JSON.parse(readFileSync(file, "utf8")));
      if (!parsed.success) {
        fail(
          `Vstup neodpovídá formátu: ${z.prettifyError(parsed.error)}`,
          `The input does not match its format: ${z.prettifyError(parsed.error)}`,
        );
      }
      const input = parsed.data;
      const [settings, items] = await Promise.all([store.settings(), store.listItems()]);
      const unknown = input.lines.flatMap((line) =>
        "code" in line && !items.some((entry) => entry.value.code === line.code) ? [line.code] : [],
      );
      if (unknown.length > 0) {
        fail(
          `Tyto kódy v ceníku nejsou: ${unknown.join(", ")}. Najděte je přes \`items --search\`, nebo je zadejte jako řádky mimo ceník.`,
          `These codes are not in the price list: ${unknown.join(", ")}. Find them with \`items --search\`, or give them as lines outside the price list.`,
        );
      }
      const lines: Omit<QuoteLine, "id">[] = input.lines.map((line) => {
        if ("code" in line) {
          const item = items.find((entry) => entry.value.code === line.code)?.value;
          if (!item) throw new Error("unreachable");
          const rate = vatRateById(settings.value, item.vat_rate);
          return {
            item_code: item.code,
            name: item.name,
            unit: item.unit,
            quantity: line.quantity,
            unit_price: item.sale_price,
            ...(item.purchase_price === undefined ? {} : { purchase_price: item.purchase_price }),
            vat_percent: rate?.percent ?? 0,
            ...(line.discount_percent ? { discount_percent: line.discount_percent } : {}),
            ...(line.description ? { description: line.description } : {}),
          };
        }
        const price = line.unit_price === undefined ? 0 : parseMoney(line.unit_price, locale);
        if (price === null || price < 0) {
          fail(
            `Cena „${line.unit_price}“ není částka.`,
            `The price “${line.unit_price}” is not an amount.`,
          );
        }
        const rate = vatRateById(settings.value, line.vat_rate ?? settings.value.default_vat_rate);
        const toCheck =
          line.to_check ??
          (line.unit_price === undefined
            ? t(
                "Není v ceníku: doplňte cenu, nebo řádek vyřaďte.",
                "Not in the price list: add a price or drop the line.",
              )
            : undefined);
        return {
          name: line.name,
          unit: line.unit ?? t("ks", "pc"),
          quantity: line.quantity,
          unit_price: price,
          vat_percent: rate?.percent ?? 0,
          ...(line.discount_percent ? { discount_percent: line.discount_percent } : {}),
          ...(line.description ? { description: line.description } : {}),
          ...(toCheck ? { to_check: toCheck } : {}),
        };
      });
      const customerId =
        typeof input.customer === "string"
          ? input.customer
          : (await service.createCustomer(input.customer)).value.id;
      const created = await service.createQuote({
        customer_id: customerId,
        title: input.title,
        lines,
        discount_percent: input.discount_percent,
        introduction: input.introduction,
        terms: input.terms,
        internal_note: input.internal_note,
        prepared_by: input.prepared_by,
      });
      const quote = created.value;
      const toCheck = quote.lines.filter((line) => line.to_check);
      print({ id: idOfQuote(quote), quote, to_check: toCheck }, () =>
        [
          t(
            `Koncept nabídky ${quote.number} je uložený (id ${idOfQuote(quote)}).`,
            `The draft quote ${quote.number} is saved (id ${idOfQuote(quote)}).`,
          ),
          describeQuote(quote, context, settings.value),
          toCheck.length > 0
            ? t(
                `Mimo ceník a k doplnění: ${toCheck.map((line) => line.name).join(", ")}.`,
                `Not in the price list, to complete: ${toCheck.map((line) => line.name).join(", ")}.`,
              )
            : t("Všechny řádky jsou z ceníku.", "Every line comes from the price list."),
          t(
            "Koncept zkontroluje a publikuje člověk v aplikaci (Koncept a publikování).",
            "A person reviews and publishes the draft in the App (Draft & publish).",
          ),
        ].join("\n"),
      );
      return 0;
    }
    case "quote:show": {
      const quote = await quoteOf(context, options.args[0]);
      const settings = await store.settings();
      print({ id: idOfQuote(quote), quote, totals: calculateQuote(quote, settings.value) }, () =>
        describeQuote(quote, context, settings.value),
      );
      return 0;
    }
    case "quote:check": {
      const quote = await quoteOf(context, options.args[0]);
      const { issues } = await service.checkQuote(idOfQuote(quote), locale);
      const errors = issues.filter((issue) => issue.severity === "error");
      print({ id: idOfQuote(quote), ready: errors.length === 0, issues }, () =>
        issues.length === 0
          ? t(
              `${quote.number} v${quote.version}: připravená k odeslání.`,
              `${quote.number} v${quote.version}: ready to go out.`,
            )
          : [
              t(
                `${quote.number} v${quote.version}: chyby ${errors.length}, upozornění ${issues.length - errors.length}.`,
                `${quote.number} v${quote.version}: errors ${errors.length}, warnings ${issues.length - errors.length}.`,
              ),
              ...issues.map(
                (issue) =>
                  `  ${issue.severity === "error" ? t("CHYBA", "ERROR") : t("POZOR", "WARNING")}  ${issue.message}`,
              ),
            ].join("\n"),
      );
      return errors.length === 0 ? 0 : 1;
    }
    case "quote:email": {
      const quote = await quoteOf(context, options.args[0]);
      const email = await service.email(idOfQuote(quote), locale);
      print(email, () =>
        [
          `${t("Komu", "To")}: ${email.to ?? t("(zákazník nemá e-mail)", "(the customer has no e-mail)")}`,
          `${t("Předmět", "Subject")}: ${email.subject}`,
          `${t("Příloha", "Attachment")}: ${email.attachment}`,
          "",
          email.body,
        ].join("\n"),
      );
      return 0;
    }
    case "quote:print": {
      const quote = await quoteOf(context, options.args[0]);
      const path = `/print/quotes/${encodeURIComponent(idOfQuote(quote))}?lang=${locale}`;
      print({ path }, () => path);
      return 0;
    }
    case "import:preview":
    case "import:apply": {
      const file = flag("csv");
      const supplier = flag("supplier");
      if (!file || !supplier) {
        fail(
          "Chybí --csv <soubor> nebo --supplier <název>.",
          "--csv <file> or --supplier <name> is missing.",
        );
      }
      const encoding = flag("encoding") ?? "utf-8";
      const csv = new TextDecoder(encoding).decode(readFileSync(file));
      const markup = flag("markup");
      const request = {
        csv,
        options: {
          supplier,
          valid_from: flag("valid-from") ?? service.today(),
          ...(markup === undefined ? {} : { markup_percent: Number(markup) }),
          ...(options.flags.has("round-crowns") ? { round_to_crowns: true } : {}),
          ...(flag("category") ? { category: flag("category") } : {}),
          note: `${supplier}: ${file.split(/[\\/]/).at(-1)}`,
        },
      };
      const { preview, revisions } = await service.importPreview(request, locale);
      if (options.command === "import:preview") {
        print({ preview, revisions }, () =>
          [
            t(
              `Nové ${preview.counts.new}, změněné ${preview.counts.changed}, beze změny ${preview.counts.unchanged}, chybné ${preview.counts.invalid}.`,
              `New ${preview.counts.new}, changed ${preview.counts.changed}, unchanged ${preview.counts.unchanged}, invalid ${preview.counts.invalid}.`,
            ),
            ...preview.rows.map((row) => {
              const money = (amount: number | undefined) =>
                amount === undefined ? "–" : formatMoney(amount, "CZK", locale);
              if (row.kind === "new")
                return `  ${row.line}  ${t("NOVÁ", "NEW")}  ${row.item.code}  ${row.item.name}  ${money(row.item.purchase_price)} → ${money(row.item.sale_price)}`;
              if (row.kind === "changed") {
                return `  ${row.line}  ${t("ZMĚNA", "CHANGE")}  ${row.item.code}  ${row.fields.join(", ")}  ${money(row.before.purchase_price)} → ${money(row.item.purchase_price)} / ${money(row.before.sale_price)} → ${money(row.item.sale_price)}`;
              }
              if (row.kind === "invalid")
                return `  ${row.line}  ${t("CHYBA", "ERROR")}  ${row.supplierCode ?? ""}  ${row.problems.join("; ")}`;
              return `  ${row.line}  ${t("beze změny", "unchanged")}  ${row.code}`;
            }),
            ...(preview.missing.length > 0
              ? [
                  t(
                    `V souboru chybí položky dodavatele: ${preview.missing.map((entry) => entry.code).join(", ")}.`,
                    `The file lacks the supplier's items: ${preview.missing.map((entry) => entry.code).join(", ")}.`,
                  ),
                ]
              : []),
          ].join("\n"),
        );
        return 0;
      }
      const rows = flag("rows")
        ?.split(",")
        .map((value) => Number(value.trim()));
      const written = await service.importApply(
        { ...request, revisions, ...(rows ? { lines: rows } : {}) },
        locale,
      );
      print({ written: written.map((entry) => entry.value.code) }, () =>
        t(
          `Do konceptu se uložilo ${written.length} položek. Publikuje je člověk v aplikaci.`,
          `${written.length} items were saved to the draft. A person publishes them in the App.`,
        ),
      );
      return 0;
    }
    case "check": {
      const issues = await store.check(locale);
      print(issues, () =>
        issues.length === 0
          ? t("Data odpovídají schématům a pravidlům.", "The data matches its schemas and rules.")
          : issues.map((issue) => `${issue.record}: ${issue.message}`).join("\n"),
      );
      return issues.length === 0 ? 0 : 1;
    }
    default:
      out(USAGE);
      return options.command === "help" || options.command === "--help" ? 0 : 2;
  }
}

if (import.meta.main) {
  const options = parseArgs(process.argv.slice(2));
  const locale = parseLocale(options.flags.get("lang")) ?? "cs";
  const demo = options.flags.has("demo");
  const db = options.flags.get("db");
  let store: QuotesStore;
  if (demo) {
    const sample = readDataDirectory(seedDirectory(locale, "sample"));
    store = createMemoryStore(sample.data);
  } else {
    store = createRepositoryDbStore({
      mountRoot: typeof db === "string" ? db : DATA_MOUNT,
      ...(typeof db === "string" ? {} : { expect: { ...dataRepository, within: MODULE_ROOT } }),
      intervalMs: 0,
    });
  }
  const context: Context = {
    store,
    service: createService(store),
    locale,
    json: options.flags.has("json"),
    out: (text) => console.log(text),
  };
  let code = 1;
  try {
    code = await run(options, context);
  } catch (error) {
    console.error(
      error instanceof StoreError
        ? error.messageIn(locale)
        : error instanceof Error
          ? error.message
          : String(error),
    );
  } finally {
    store.close();
  }
  process.exit(code);
}
