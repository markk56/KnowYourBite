import i18next, { type i18n, type InitOptions } from 'i18next'
import ICU from 'i18next-icu'
import { defaultNS, namespaces, resources } from './resources'

export * from './format'
export { resources, namespaces, defaultNS } from './resources'
export type { Namespace } from './resources'

export const SUPPORTED_LOCALES = ['en', 'ro', 'hu'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'en'

export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

/** Init options shared by the standalone instance and the React client. */
export const baseInitOptions: InitOptions = {
  resources,
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: SUPPORTED_LOCALES,
  ns: namespaces,
  defaultNS,
  interpolation: { escapeValue: false },
  returnNull: false,
  // Resources are bundled — initialize synchronously so t() works on first render.
  initImmediate: false,
}

/** Standalone (non-React) i18n instance for the server and tests. */
export async function createI18n(locale: Locale = DEFAULT_LOCALE): Promise<i18n> {
  const instance = i18next.createInstance()
  await instance.use(ICU).init({ ...baseInitOptions, lng: locale })
  return instance
}
