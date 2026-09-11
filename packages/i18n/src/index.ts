import { he } from './dictionaries/he';
import { en } from './dictionaries/en';
import type { SupportedLocale, TranslationKey, TranslationSchema } from './types';

const dictionaries: Record<SupportedLocale, TranslationSchema> = {
  he,
  en,
};

/**
 * Returns whether the specified locale is Right-to-Left (RTL).
 * Hebrew ('he') is RTL.
 */
export function isRtlLocale(locale: SupportedLocale = 'he'): boolean {
  return locale === 'he';
}

/**
 * Resolve a nested translation key using dot notation.
 * Defaults to Hebrew ('he').
 */
export function t(
  key: TranslationKey,
  params?: Record<string, string | number>,
  locale: SupportedLocale = 'he'
): string {
  const dictionary = dictionaries[locale] || dictionaries.he;
  const parts = key.split('.');

  let current: unknown = dictionary;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      current = undefined;
      break;
    }
  }

  if (typeof current !== 'string') {
    // Fallback to Hebrew if missing in requested locale
    if (locale !== 'he') {
      return t(key, params, 'he');
    }
    return key;
  }

  let result = current;
  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      result = result.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
    }
  }

  return result;
}

export * from './types';
export { he, en };
