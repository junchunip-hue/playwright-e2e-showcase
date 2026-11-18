import playwright from 'eslint-plugin-playwright';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/', 'playwright-report/', 'test-results/', 'blob-report/', 'playwright/.auth/', 'toolshop/'] },
  ...tseslint.configs.recommended,
  {
    ...playwright.configs['flat/recommended'],
    files: ['tests/**/*.ts'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      // Custom assertions count as expect() (src/known-defects.ts).
      'playwright/expect-expect': ['warn', { assertFunctionNames: ['expectKnownDefect'] }],
      // Environment gates such as test.skip(isPublicDemo, ...) are allowed; unconditional skips are not.
      'playwright/no-skipped-test': ['warn', { allowConditional: true }],
    },
  },
);
