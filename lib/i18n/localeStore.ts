import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Locale = 'zh-CN' | 'en';

let hydrationStarted = false;

interface LocaleStore {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const noopStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

export const useLocaleStore = create<LocaleStore>()(
  persist(
    set => ({
      locale: 'zh-CN',
      setLocale: locale => set({ locale }),
    }),
    {
      name: 'avalon-locale',
      storage: createJSONStorage(() => (
        typeof window === 'undefined' ? noopStorage : localStorage
      )),
      skipHydration: true,
    },
  ),
);

export function hydrateLocaleStore() {
  if (hydrationStarted) return;
  hydrationStarted = true;
  void useLocaleStore.persist.rehydrate();
}
