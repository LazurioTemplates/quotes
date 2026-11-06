import { createContext, useContext, useMemo } from "react";
import { formatDate } from "../domain/common.ts";
import {
  formatAmount,
  formatMoney,
  formatNumber,
  formatPercent,
  parseMoney,
  parsePercent,
  parseQuantity,
} from "../domain/money.ts";
import { DEFAULT_LOCALE, type Locale, type Localized, pick } from "../i18n/locale.ts";

/**
 * Every text of the interface is written in both languages side by side,
 * `t("Ceník", "Price list")`, so neither can be forgotten and a screen never
 * mixes them. Amounts, numbers and dates follow the same language.
 */
export const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** The words of a count: Czech has one, few (2–4) and many; English one and other. */
export interface CountWords {
  cs: { one: string; few: string; many: string };
  en: { one: string; other: string };
}

export function countWord(locale: Locale, count: number, words: CountWords): string {
  const rule = new Intl.PluralRules(locale).select(count);
  if (locale === "en") return rule === "one" ? words.en.one : words.en.other;
  return rule === "one" ? words.cs.one : rule === "few" ? words.cs.few : words.cs.many;
}

export function useT() {
  const locale = useLocale();
  return useMemo(() => {
    const t = (cs: string, en: string) => pick(locale, cs, en);
    return Object.assign(t, {
      of: (text: Localized) => text[locale],
      /** `3 položky`, `5 položek`, `1 item`: the number and its word. */
      count: (count: number, words: CountWords) => `${count} ${countWord(locale, count, words)}`,
    });
  }, [locale]);
}

/** Formatting and parsing in the interface's language. */
export function useFormat() {
  const locale = useLocale();
  return useMemo(
    () => ({
      locale,
      money: (amount: number, currency = "CZK") => formatMoney(amount, currency, locale),
      amount: (amount: number) => formatAmount(amount, locale),
      number: (value: number) => formatNumber(value, locale),
      percent: (value: number) => formatPercent(value, locale),
      date: (value: string | undefined) => formatDate(value, locale),
      parseMoney: (text: string) => parseMoney(text, locale),
      parseQuantity: (text: string) => parseQuantity(text, locale),
      parsePercent: (text: string) => parsePercent(text, locale),
    }),
    [locale],
  );
}
