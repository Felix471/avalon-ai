'use client';

import { useEffect } from 'react';
import { en, zh } from './strings';
import { hydrateLocaleStore, type Locale, useLocaleStore } from './localeStore';

export type TranslationKey = keyof typeof zh;
export type TranslationParams = Record<string, string | number>;

export const LOCALES = [
  { locale: 'zh-CN', label: '中' },
  { locale: 'en', label: 'EN' },
] as const;

export function t(locale: Locale, key: TranslationKey, params?: TranslationParams): string {
  const template = locale === 'en' ? en[key] : zh[key];
  if (!params) return template;

  return template.replace(/\{([^}]+)\}/g, (placeholder, name: string) => (
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : placeholder
  ));
}

export function useLocale() {
  const locale = useLocaleStore(state => state.locale);
  const setLocale = useLocaleStore(state => state.setLocale);

  useEffect(() => {
    hydrateLocaleStore();
  }, []);

  return { locale, setLocale };
}

export function useT() {
  const { locale } = useLocale();
  return (key: TranslationKey, params?: TranslationParams) => t(locale, key, params);
}
