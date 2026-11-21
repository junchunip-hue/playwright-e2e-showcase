import type { Page, TestInfo } from '@playwright/test';

/**
 * Failure evidence: a full-page screenshot at the moment a step fails (Java twin: steps/Hooks.java, @AfterStep).
 *
 * The `page` fixture registers its page here (src/fixtures/index.ts), without creating one: API-only tests never ask
 * for a page and get no screenshot, because there is nothing to show. When a Gherkin step fails, the AfterStep hook
 * (src/steps/not-run.hooks.ts) runs inside that step and calls `screenshotFailedStep()`, so the screenshot is attached
 * to the failed step itself, taken before anything else happens to the page. A test that fails outside a Gherkin step
 * (a plain spec, a fixture) still gets one screenshot when its page closes (`screenshotIfFailedWithout()`), so
 * Playwright's own `screenshot: 'only-on-failure'` is off: it would add a second, later one.
 */
const pages = new WeakMap<TestInfo, Page>();
const taken = new WeakSet<TestInfo>();

export function rememberPage(testInfo: TestInfo, page: Page): void {
  pages.set(testInfo, page);
}

async function capture(testInfo: TestInfo, name: string): Promise<void> {
  const page = pages.get(testInfo);
  if (!page || page.isClosed() || page.url() === 'about:blank') return;
  try {
    const body = await page.screenshot({ fullPage: true, timeout: 5_000 });
    await testInfo.attach(name, { body, contentType: 'image/png' });
    taken.add(testInfo);
  } catch {
    // The page may be gone (crashed, navigated away mid-shot): the step's error is the evidence then.
  }
}

/** The page as it is when the step failed, attached to that step. */
export async function screenshotFailedStep(testInfo: TestInfo, step: string): Promise<void> {
  await capture(testInfo, `screenshot at failure: ${step}`);
}

/** For a test that failed outside a Gherkin step: one screenshot as its page closes. */
export async function screenshotIfFailedWithout(testInfo: TestInfo): Promise<void> {
  if (testInfo.status === testInfo.expectedStatus || taken.has(testInfo)) return;
  await capture(testInfo, 'screenshot at failure');
}
