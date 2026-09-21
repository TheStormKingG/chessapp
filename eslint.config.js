import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // `.cache` holds the gitignored build inputs — the ~1 GB decompressed Lichess
  // puzzle dump among them. ESLint lints nothing in there, but it walked it,
  // which took a clean lint from seconds to minutes.
  { ignores: ['dist', 'dev-dist', 'public/engine', 'node_modules', 'playwright-report', 'test-results', '.cache', 'dist-e2e*'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}', 'scripts/**/*.mjs'],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
