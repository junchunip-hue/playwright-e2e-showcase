import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
import { env, isPublicDemo, STORAGE_STATE } from './src/config/env';
import { CHROMIUM_ONLY, resolveSuite, suiteGrep, suiteGrepInvert } from './src/tags';

const isCI = !!process.env.CI;
// Be gentle with the shared public demo (isPublicDemo); a local Docker instance can take full parallelism.
// Playwright's Firefox build fails to start on some Windows 11 machines (SxS "mozglue" error),
// so Firefox and WebKit run in CI (Linux) by default and locally only on request: ALL_BROWSERS=1.
// The PR smoke job still picks only --project=chromium; the nightly run uses all of them.
const runAllBrowsers = isCI || !!process.env.ALL_BROWSERS;

// Gherkin features (features/, shared with the Java suite) become Playwright tests: `npx bddgen` writes them to
// tests/features/**/*.feature.spec.js (git-ignored) from the features and the steps in src/steps/.
// playwright-bdd needs the projects' testDir to be its outputDir, hence `tests`. Before generating it deletes
// only *.spec.js there; hand-written tests are *.spec.ts. Every npm test script and CI step runs bddgen first.
defineBddConfig({
  features: 'features/**/*.feature',
  // Steps, plus the fixtures they get injected (page objects, API client, ctx), as the plain specs do.
  steps: ['src/steps/**/*.ts', 'src/fixtures/index.ts'],
  outputDir: 'tests',
});

// tests/ is split by intent: api/ and architecture/ need no browser; ui/ (the agents' seed) and quality/ do, and so
// do the generated UI and journey features.
const BROWSER_TESTS = /[\\/]tests[\\/]((ui|quality)[\\/].*\.spec\.ts|features[\\/](ui|journeys)[\\/].*\.spec\.js)$/;

// Which tests run is decided by name only (SUITE=pr, SUITE=nightly, ...); the tag lists live in src/tags.ts.
const suite = resolveSuite(process.env.SUITE);

export default defineConfig({
  testDir: './tests',
  grep: suiteGrep(suite),
  grepInvert: suiteGrepInvert(suite),
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isPublicDemo ? 2 : undefined,
  // In CI the JSON results feed the pipeline summary (scripts/pipeline-summary.mjs).
  reporter: isCI
    ? [['html', { open: 'never' }], ['github'], ['list'], ['json', { outputFile: 'reports/ts-results.json' }]]
    : [['html', { open: 'never' }], ['list']],

  // Visual baselines are generated on Linux in CI against the pinned Toolshop; the {platform} suffix keeps
  // local (Windows/macOS) baselines separate, and those are git-ignored.
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.01, // tolerate anti-aliasing noise, not layout changes
      stylePath: './src/visual/screenshot.css',
    },
  },

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

    // Static rules about the pipeline and code (cycles, self-triggering workflows): no browser, no Toolshop.
    { name: 'architecture', testDir: './tests/architecture' },

    // Browser tests: the generated UI and journey features, tests/quality (a11y, visual) and the agents' seed (tests/ui).
    {
      name: 'chromium',
      testMatch: BROWSER_TESTS,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE },
    },
    ...(runAllBrowsers
      ? [
          {
            name: 'firefox',
            testMatch: BROWSER_TESTS,
            // a11y: axe evaluates the DOM, so results do not depend on the engine.
            // visual: one set of baselines (Chromium/Linux) is enough to catch layout regressions.
            // A project grepInvert replaces the config one, so the suite's exclusions are merged in.
            grepInvert: suiteGrepInvert(suite, CHROMIUM_ONLY),
            dependencies: ['setup'],
            use: { ...devices['Desktop Firefox'], storageState: STORAGE_STATE },
          },
          {
            name: 'webkit',
            testMatch: BROWSER_TESTS,
            grepInvert: suiteGrepInvert(suite, CHROMIUM_ONLY),
            dependencies: ['setup'],
            use: { ...devices['Desktop Safari'], storageState: STORAGE_STATE },
          },
        ]
      : []),
  ],
});
