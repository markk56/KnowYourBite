import { describe, it, expect } from 'vitest'
import { createI18n, resources, SUPPORTED_LOCALES } from './index'

function leafKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return value && typeof value === 'object'
      ? leafKeys(value as Record<string, unknown>, path)
      : [path]
  })
}

describe('catalog key parity', () => {
  const enKeys = leafKeys(resources.en.common).sort()

  for (const locale of SUPPORTED_LOCALES) {
    it(`${locale} has exactly the same keys as en`, () => {
      const keys = leafKeys(resources[locale].common).sort()
      expect(keys).toEqual(enKeys)
    })
  }
})

describe('ICU pluralization', () => {
  it('applies Romanian one/few/other forms', async () => {
    const i18n = await createI18n('ro')
    expect(i18n.t('common:sample.clientCount', { count: 1 })).toBe('1 client')
    expect(i18n.t('common:sample.clientCount', { count: 3 })).toBe('3 clienți')
    expect(i18n.t('common:sample.clientCount', { count: 20 })).toBe('20 de clienți')
  })

  it('applies English one/other forms', async () => {
    const i18n = await createI18n('en')
    expect(i18n.t('common:sample.clientCount', { count: 1 })).toBe('1 client')
    expect(i18n.t('common:sample.clientCount', { count: 5 })).toBe('5 clients')
  })
})
