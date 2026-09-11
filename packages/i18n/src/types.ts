import type { he } from './dictionaries/he';

type NestedStrings<T> = {
  [K in keyof T]: T[K] extends string ? string : NestedStrings<T[K]>;
};

export type TranslationSchema = NestedStrings<typeof he>;

type PathsToStringProps<T> = T extends string
  ? []
  : {
      [K in Extract<keyof T, string>]: [K, ...PathsToStringProps<T[K]>];
    }[Extract<keyof T, string>];

type Join<T extends string[], D extends string> = T extends []
  ? never
  : T extends [infer F]
    ? F
    : T extends [infer F, ...infer R]
      ? F extends string
        ? `${F}${D}${Join<Extract<R, string[]>, D>}`
        : never
      : string;

export type TranslationKey = Join<PathsToStringProps<typeof he>, '.'>;

export type SupportedLocale = 'he' | 'en';
