import type { Reporter, TestCase, TestResult, TestStep } from '@playwright/test/reporter';

/**
 * Leaves Playwright's own `error-context.md` out of every report.
 *
 * On a failure Playwright attaches the error and a text snapshot of the page as a markdown download. Our evidence of a
 * failure is the screenshot taken at the failed step (src/fixtures/evidence.ts), the same in TypeScript and Java; the
 * error itself is already in the report. Playwright has no option to turn the attachment off, so this reporter, listed
 * before the others, takes it out of the result as soon as it appears: at the end of the step that attached it, before
 * the blob, HTML or JSON reporter records it. Attachments before it keep their positions, so step links stay right.
 */
const NAME = 'error-context';

const drop = (result: TestResult, step?: TestStep) => {
  if (step) step.attachments.splice(0, step.attachments.length, ...step.attachments.filter((a) => a.name !== NAME));
  result.attachments.splice(0, result.attachments.length, ...result.attachments.filter((a) => a.name !== NAME));
};

export default class NoErrorContext implements Reporter {
  onStepEnd(_test: TestCase, result: TestResult, step: TestStep) {
    drop(result, step);
  }

  onTestEnd(_test: TestCase, result: TestResult) {
    drop(result);
  }

  printsToStdio() {
    return false;
  }
}
