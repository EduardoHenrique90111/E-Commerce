// ESLint (flat config): TypeScript, regras de hooks do React, Fast Refresh e acessibilidade (jsx-a11y).
import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores([
    'dist',
    'node_modules',
    'reports',
    'test-results',
    'playwright/.cache',
    'lighthouse/reports',
    'public/mockServiceWorker.js',
  ]),

  // aplicação (navegador)
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // rótulos dos campos usam htmlFor/id (componentes Label/Input do shadcn/ui)
      'jsx-a11y/label-has-associated-control': ['error', { assert: 'either', controlComponents: ['Input', 'Textarea', 'NativeSelect'] }],
    },
  },

  // camada de mocks: arquivos de infraestrutura (sem Fast Refresh)
  {
    files: ['src/mocks/**/*.{ts,tsx}'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // testes, configurações e scripts (Node.js)
  {
    files: ['tests/**/*.ts', '*.config.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.node },
  },
  {
    files: ['scripts/**/*.mjs', 'lighthouse/**/*.mjs', '*.config.js', 'eslint.config.js'],
    extends: [js.configs.recommended],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: globals.node },
  },
])
