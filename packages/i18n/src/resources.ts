import enCommon from './locales/en/common.json'
import roCommon from './locales/ro/common.json'
import huCommon from './locales/hu/common.json'
import enMarketing from './locales/en/marketing.json'
import roMarketing from './locales/ro/marketing.json'
import huMarketing from './locales/hu/marketing.json'

export const namespaces = ['common', 'marketing'] as const
export type Namespace = (typeof namespaces)[number]
export const defaultNS: Namespace = 'common'

export const resources = {
  en: { common: enCommon, marketing: enMarketing },
  ro: { common: roCommon, marketing: roMarketing },
  hu: { common: huCommon, marketing: huMarketing },
} as const
