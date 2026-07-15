import { defineWorkspace } from 'vitest/config'

// Three test environments (ADR-000): pure `domain` + node packages/server run in
// Node; the web client runs in jsdom (its own config lives in apps/web).
export default defineWorkspace([
  {
    test: {
      name: 'domain',
      root: './packages/domain',
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  },
  {
    test: {
      name: 'shared',
      root: './packages/shared',
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  },
  {
    test: {
      name: 'i18n',
      root: './packages/i18n',
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  },
  {
    test: {
      name: 'server',
      root: './apps/server',
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  },
  './apps/web/vitest.config.ts',
])
