import playwright from 'eslint-plugin-playwright';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules/',
      'playwright-report/',
      'test-results/',
      'blob-report/',
      'playwright/.auth/',
      'toolshop/',
      'tests/features/',
    ],
  },
  ...tseslint.configs.recommended,
  // Import order (docs/coding-rules.md): packages first, then relative imports, each group sorted. `npm run format` fixes it.
  {
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: { 'simple-import-sort/imports': 'error', 'simple-import-sort/exports': 'error' },
  },
  {
    ...playwright.configs['flat/recommended'],
    files: ['tests/**/*.ts'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      // Environment gates such as test.skip(isPublicDemo, ...) are allowed; unconditional skips are not.
      'playwright/no-skipped-test': ['warn', { allowConditional: true }],
    },
  },
);
