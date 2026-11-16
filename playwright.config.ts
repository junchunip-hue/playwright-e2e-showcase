import { defineConfig, devices } from '@playwright/test';
import { env, STORAGE_STATE } from './src/config/env';

const isCI = !!process.env.CI;
// Be gentle with the shared public demo; a local Docker instance can take full parallelism.
const isPublicDemo = env.baseURL.includes('practicesoftwaretesting.com');
// Playwright's Firefox build fails to start on some Windows 11 machines (SxS "mozglue" error),
// so Firefox and WebKit run in CI (Linux) by default and locally only on request: ALL_BROWSERS=1.
// The PR smoke job still picks only --project=chromium; the nightly run uses all of them.
const runAllBrowsers = isCI || !!process.env.ALL_BROWSERS;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isPublicDemo ? 2 : undefined,
  reporter: isCI
    ? [['html', { open: 'never' }], ['github'], ['list']]
    : [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: env.baseURL,
    testIdAttribute: 'data-test', // Toolshop exposes data-test attributes -> getByTestId()
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Logs in once via UI and saves the session for all UI projects.
    { name: 'setup', testMatch: /.*\.setup\.ts/ },

    // Pure API tests: no browser needed.
    { name: 'api', testDir: './tests/api' },

    {
      name: 'chromium',
      testDir: './tests/ui',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE },
    },
    ...(runAllBrowsers
      ? [
          {
            name: 'firefox',
            testDir: './tests/ui',
            dependencies: ['setup'],
            use: { ...devices['Desktop Firefox'], storageState: STORAGE_STATE },
          },
          {
            name: 'webkit',
            testDir: './tests/ui',
            dependencies: ['setup'],
            use: { ...devices['Desktop Safari'], storageState: STORAGE_STATE },
          },
        ]
      : []),
  ],
});
