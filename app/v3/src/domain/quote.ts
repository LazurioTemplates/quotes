import { z } from "zod";
import { type Locale, type Localized, pick } from "../i18n/locale.ts";
import { itemCode } from "./catalog.ts";
import { addDays, currencyCode, isoDate, optionalText, text } from "./common.ts";
import { customerId } from "./customer.ts";
import { money, percent, quantity } from "./money.ts";
import type { Settings } from "./settings.ts";

/**
 * A quote for a customer. Every version of a quote is a record of its own
 * (`data/quotes/<number>-v<version>.yaml`): a quote that went out is never
 * changed again, an edit after that is the next version, a draft of its own.
 */
export const QUOTE_STATUSES = ["draft", "sent", "accepted", "rejected", "expired"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

/** A quote number as the format produced it: letters, digits, `.`, `_` and `-`. */
export const QUOTE_NUMBER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,47}$/;

export const quoteLine = z.strictObject({
  id: z.string().regex(/^l[0-9]{1,4}$/, { message: "expected l1, l2, …" }),
  item_code: itemCode.optional(),
  name: text,
  description: optionalText,
  unit: text,
  quantity,
  unit_price: money,
  purchase_price: money.optional(),
  vat_percent: percent,
  discount_percent: percent.optional(),
  to_check: optionalText,
});

/** The customer as the quote names them: a copy of the contact taken while it is a draft. */
export const quoteCustomer = z.strictObject({
  id: customerId,
  name: text,
  company_id: optionalText,
  vat_id: optionalText,
  street: optionalText,
  city: optionalText,
  postal_code: optionalText,
  country: optionalText,
  contact_person: optionalText,
  email: optionalText,
  phone: optionalText,
});

export const quote = z.strictObject({
  number: z.string().regex(QUOTE_NUMBER, { message: "expected a quote number" }),
  version: z.int().min(1).max(999),
  status: z.enum(QUOTE_STATUSES),
  title: text,
  customer: quoteCustomer,
  issue_date: isoDate,
  valid_until: isoDate,
  currency: currencyCode,
  lines: z.array(quoteLine),
  discount_percent: percent.optional(),
  introduction: optionalText,
  terms: optionalText,
  internal_note: optionalText,
  prepared_by: optionalText,
  created_at: isoDate,
  updated_at: isoDate,
  sent_at: isoDate.optional(),
  closed_at: isoDate.optional(),
  previous_version: z.int().min(1).optional(),
});

export type Quote = z.infer<typeof quote>;
export type QuoteLine = z.infer<typeof quoteLine>;
export type QuoteCustomer = z.infer<typeof quoteCustomer>;

/** The record id of one version: `NAB-2026-0007-v2`. */
export function quoteId(number: string, version: number): string {
  return `${number}-v${version}`;
}

export function idOfQuote(value: Pick<Quote, "number" | "version">): string {
  return quoteId(value.number, value.version);
}

/** The next free line id of a quote: `l4` after `l1`–`l3`. */
export function nextLineId(lines: readonly Pick<QuoteLine, "id">[]): string {
  const highest = lines.reduce((max, line) => Math.max(max, Number(line.id.slice(1)) || 0), 0);
  return `l${highest + 1}`;
}

// --- Numbers ----------------------------------------------------------------

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The next quote number for `date` under `format`: the counter continues
 * after the highest number of the same period (`{YYYY}` and `{MM}` decide the
 * period; without them it never resets). Numbers of other formats are ignored.
 */
export function nextQuoteNumber(format: string, date: string, existing: readonly string[]): string {
  const [year = "", month = ""] = date.split("-");
  const counter = /\{(N+)\}/.exec(format);
  if (!counter?.[1]) throw new Error("the number format has no counter {N…}");
  const width = counter[1].length;
  const fixed = (part: string) =>
    part.replaceAll("{YYYY}", year).replaceAll("{YY}", year.slice(2)).replaceAll("{MM}", month);
  const [before = "", after = ""] = format.split(counter[0]);
  const pattern = new RegExp(
    `^${escapeRegExp(fixed(before))}([0-9]+)${escapeRegExp(fixed(after))}$`,
  );
  let highest = 0;
  for (const number of existing) {
    const match = pattern.exec(number);
    if (match?.[1]) highest = Math.max(highest, Number(match[1]));
  }
  const next = String(highest + 1).padStart(width, "0");
  return `${fixed(before)}${next}${fixed(after)}`;
}

/** Why a number format cannot be used, or null when it can. */
export function numberFormatProblem(format: string, locale: Locale = "cs"): string | null {
  if (!/^(?:[A-Za-z0-9._-]|\{YYYY\}|\{YY\}|\{MM\}|\{N{1,8}\})+$/.test(format)) {
    return pick(
      locale,
      "formát smí obsahovat písmena, číslice, . _ - a značky {YYYY} {YY} {MM} {NNNN}",
      "the format may hold letters, digits, . _ - and the tokens {YYYY} {YY} {MM} {NNNN}",
    );
  }
  const counters = format.match(/\{N+\}/g) ?? [];
  if (counters.length !== 1) {
    return pick(
      locale,
      "formát čísla potřebuje právě jedno počítadlo {NNNN}",
      "the number format needs exactly one counter {NNNN}",
    );
  }
  const sample = nextQuoteNumber(format, "2026-01-01", []);
  if (!QUOTE_NUMBER.test(sample)) {
    return pick(
      locale,
      "formát musí začínat písmenem nebo číslicí",
      "the format must start with a letter or a digit",
    );
  }
  return null;
}

// --- Lifecycle --------------------------------------------------------------

export const QUOTE_ACTIONS = ["send", "accept", "reject", "expire"] as const;
export type QuoteAction = (typeof QUOTE_ACTIONS)[number];

const TRANSITIONS: Record<QuoteAction, { from: readonly QuoteStatus[]; to: QuoteStatus }> = {
  send: { from: ["draft"], to: "sent" },
  accept: { from: ["sent"], to: "accepted" },
  reject: { from: ["sent"], to: "rejected" },
  expire: { from: ["sent"], to: "expired" },
};

export const STATUS_LABELS: Record<QuoteStatus, Localized> = {
  draft: { cs: "Koncept", en: "Draft" },
  sent: { cs: "Odeslaná", en: "Sent" },
  accepted: { cs: "Přijatá", en: "Accepted" },
  rejected: { cs: "Odmítnutá", en: "Rejected" },
  expired: { cs: "Propadlá", en: "Expired" },
};

export const ACTION_LABELS: Record<QuoteAction, Localized> = {
  send: { cs: "Označit jako odeslanou", en: "Mark as sent" },
  accept: { cs: "Přijatá zákazníkem", en: "Accepted by the customer" },
  reject: { cs: "Odmítnutá zákazníkem", en: "Rejected by the customer" },
  expire: { cs: "Označit jako propadlou", en: "Mark as expired" },
};

/** The actions a quote in this state allows. */
export function allowedActions(value: Pick<Quote, "status">): QuoteAction[] {
  return QUOTE_ACTIONS.filter((action) => TRANSITIONS[action].from.includes(value.status));
}

/** Only a draft is edited in place; anything else becomes a new version. */
export function isEditable(value: Pick<Quote, "status">): boolean {
  return value.status === "draft";
}

/** A quote that went out may continue as a new version, unless the customer accepted it. */
export function canCreateVersion(value: Pick<Quote, "status">): boolean {
  return value.status === "sent" || value.status === "rejected" || value.status === "expired";
}

/** The quote after an action, or why the state does not allow it. */
export function applyAction(value: Quote, action: QuoteAction, today: string): Quote | Localized {
  const transition = TRANSITIONS[action];
  if (!transition.from.includes(value.status)) {
    const status = STATUS_LABELS[value.status];
    const step = ACTION_LABELS[action];
    return {
      cs: `Nabídka ve stavu „${status.cs}“ tento krok nedovoluje (${step.cs.toLowerCase()}).`,
      en: `A quote in the state “${status.en}” does not allow this step (${step.en.toLowerCase()}).`,
    };
  }
  const next: Quote = { ...value, status: transition.to, updated_at: today };
  if (action === "send") next.sent_at = today;
  else next.closed_at = today;
  return next;
}

/** A sent quote past its validity, which someone should mark as expired. */
export function isPastValidity(value: Pick<Quote, "status" | "valid_until">, today: string) {
  return value.status === "sent" && value.valid_until < today;
}

/**
 * The next version of a quote: a draft with the same number and content,
 * dated today and valid for the usual number of days.
 */
export function nextVersion(
  value: Quote,
  settings: Pick<Settings, "validity_days">,
  today: string,
) {
  const { sent_at: _sent, closed_at: _closed, previous_version: _previous, ...content } = value;
  return {
    ...content,
    version: value.version + 1,
    status: "draft",
    issue_date: today,
    valid_until: addDays(today, settings.validity_days),
    created_at: today,
    updated_at: today,
    previous_version: value.version,
  } satisfies Quote;
}

/** The latest version of every quote number, newest number first. */
export function latestVersions<T extends Pick<Quote, "number" | "version">>(values: readonly T[]) {
  const latest = new Map<string, T>();
  for (const value of values) {
    const current = latest.get(value.number);
    if (!current || current.version < value.version) latest.set(value.number, value);
  }
  return [...latest.values()].sort((left, right) => right.number.localeCompare(left.number));
}
