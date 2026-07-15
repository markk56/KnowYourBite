#!/usr/bin/env node
/**
 * CI i18n guard (IMPLEMENTATION-ROADMAP.md M0.7). Fails the build if the EN/RO/HU
 * catalogs drift out of key parity — no missing keys, no orphan keys. Run via
 * `npm run i18n:check`. Complements the in-package Vitest parity test.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const localesDir = join(here, '..', 'packages', 'i18n', 'src', 'locales')

const LOCALES = ['en', 'ro', 'hu']
const NAMESPACES = ['common']
const REFERENCE = 'en'

function leafKeys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return value && typeof value === 'object' ? leafKeys(value, path) : [path]
  })
}

function load(locale, ns) {
  return JSON.parse(readFileSync(join(localesDir, locale, `${ns}.json`), 'utf8'))
}

let failed = false

for (const ns of NAMESPACES) {
  const referenceKeys = new Set(leafKeys(load(REFERENCE, ns)))

  for (const locale of LOCALES) {
    if (locale === REFERENCE) continue
    const keys = new Set(leafKeys(load(locale, ns)))
    const missing = [...referenceKeys].filter((k) => !keys.has(k))
    const extra = [...keys].filter((k) => !referenceKeys.has(k))

    if (missing.length || extra.length) {
      failed = true
      console.error(`✗ ${locale}/${ns}`)
      if (missing.length) console.error(`    missing: ${missing.join(', ')}`)
      if (extra.length) console.error(`    orphan:  ${extra.join(', ')}`)
    }
  }
}

if (failed) {
  console.error('\ni18n guard FAILED — locales are out of key parity.')
  process.exit(1)
}

console.log('✓ i18n guard passed: en / ro / hu are in key parity.')
