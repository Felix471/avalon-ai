'use client';

import { useT, type TranslationKey, type TranslationParams } from '@/lib/i18n';

export default function LocalizedText({
  i18nKey,
  params,
}: {
  i18nKey: TranslationKey;
  params?: TranslationParams;
}) {
  const translate = useT();
  return <>{translate(i18nKey, params)}</>;
}
