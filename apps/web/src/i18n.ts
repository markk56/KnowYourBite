import i18next from 'i18next'
import ICU from 'i18next-icu'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import { baseInitOptions, DEFAULT_LOCALE } from '@kyb/i18n'

// Resources are bundled (no async backend), so init resolves synchronously and
// `t()` returns real strings on first render — no suspense needed.
void i18next
  .use(ICU)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    ...baseInitOptions,
    fallbackLng: DEFAULT_LOCALE,
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'kyb-locale',
      caches: ['localStorage'],
    },
    react: { useSuspense: false },
  })

export default i18next
