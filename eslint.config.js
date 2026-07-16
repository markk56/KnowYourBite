// @ts-check
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import importPlugin from 'eslint-plugin-import'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'

// Non-type-aware config: fast, robust, and enough for our rules (boundary zones,
// consistent type imports, unused vars, react-hooks, a11y). Type safety itself
// is enforced by `npm run typecheck`.
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/node_modules/**',
      '.local/**',
      '.agents/**',
      '.cache/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // TypeScript sources: boundary enforcement + import hygiene.
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { import: importPlugin },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './packages/domain',
              from: './apps',
              message: 'packages/domain must stay pure — no imports from apps/*.',
            },
            {
              target: './packages/domain',
              from: './packages/i18n',
              message: 'packages/domain must stay pure — no i18n/presentation imports.',
            },
            {
              target: './apps/web',
              from: './apps/server',
              message: 'The web client must not import server code (security boundary).',
            },
            {
              target: './apps/server',
              from: './apps/web',
              message: 'The server must not import web client code.',
            },
          ],
        },
      ],
    },
  },

  // React client.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // Node globals for server, packages, tooling, and scripts.
  {
    files: ['apps/server/**/*.ts', 'packages/**/*.ts', '*.{ts,js,mjs}', 'scripts/**/*.mjs'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // Tests may use dev-only patterns.
  {
    files: ['**/*.test.{ts,tsx}', 'e2e/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
)
