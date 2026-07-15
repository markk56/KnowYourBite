import enCommon from './locales/en/common.json'
import roCommon from './locales/ro/common.json'
import huCommon from './locales/hu/common.json'

export const namespaces = ['common'] as const
export type Namespace = (typeof namespaces)[number]
export const defaultNS: Namespace = 'common'

export const resources = {
  en: { common: enCommon },
  ro: { common: roCommon },
  hu: { common: huCommon },
} as const
