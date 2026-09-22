'use client';

import { useEffect } from 'react';
import { LOCALES, useLocale } from '@/lib/i18n';

export default function LocaleToggle() {
  const { locale, setLocale } = useLocale();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <div
      data-testid="locale-toggle"
      aria-label="Switch language"
      role="group"
      className="inline-flex rounded-full border border-slate-600 bg-slate-800/80 p-0.5 text-xs"
    >
      {LOCALES.map(option => (
        <button
          key={option.locale}
          type="button"
          onClick={() => setLocale(option.locale)}
          aria-pressed={locale === option.locale}
          className={`rounded-full px-2.5 py-1 transition-colors ${
            locale === option.locale
              ? 'bg-amber-500 font-semibold text-slate-950'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
