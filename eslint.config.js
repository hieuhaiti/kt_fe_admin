import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores([
    'dist',
    'build',
    'coverage',
    'playwright-report',
    'test-results',
    'tailwind.config.cjs',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      reactX.configs['recommended-typescript'],
      reactDom.configs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Allow exported constants and variants in component modules for Fast Refresh
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Radix UI primitives and custom wrappers require forwardRef
      'react-x/no-forward-ref': 'off',
      // Avoid duplicate rule conflicts with standard eslint-plugin-react-hooks
      'react-x/exhaustive-deps': 'off',
      'react-x/set-state-in-effect': 'off',
      'react-x/static-components': 'off',
      // Allow empty object / interfaces in API definitions when semantically appropriate
      '@typescript-eslint/no-empty-object-type': ['error', { allowInterfaces: 'with-single-extends' }],
    },
  },
])

