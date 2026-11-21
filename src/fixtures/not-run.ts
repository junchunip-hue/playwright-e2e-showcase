import type { TestInfo } from '@playwright/test';

/**
 * Not-run steps at the same level as the Gherkin steps.
 *
 * When a Gherkin step fails, the scenario stops: the steps after it never run, and Playwright's report would not show
 * them at all. playwright-bdd runs every Gherkin step through `test.step()` of our `test` (src/fixtures/index.ts), so
 * that call is wrapped here: when a Gherkin step fails, the wrapper adds each remaining Gherkin step right after it, at
 * the same level, as a skipped step with the step's own text and location, and then rethrows the failure. The report
 * then reads like the scenario: ✓ passed steps, ✗ the failed step, ⊘ every step after it (skipped).
 *
 * Which steps remain is known inside the failed step only (playwright-bdd's step data), so the AfterStep hook in
 * src/steps/not-run.hooks.ts hands them over with `rememberNotRun()`.
 */
export interface NotRunStep {
  /** The Gherkin step with its keyword, e.g. "When I request the first page of products". */
  title: string;
  /** Where the step is called in the generated test, like the Gherkin steps that ran. */
  location: { file: string; line: number; column: number };
}

const pending = new WeakMap<TestInfo, NotRunStep[]>();

/** Called by the AfterStep hook of a failed Gherkin step: the steps after it, to be listed once it has failed. */
export function rememberNotRun(testInfo: TestInfo, steps: NotRunStep[]): void {
  pending.set(testInfo, steps);
}

type StepLocation = { file: string; line: number; column: number };
type StepFn = (
  title: string,
  body: (info: unknown) => unknown,
  options?: { location?: StepLocation },
) => Promise<unknown>;

/** The first stack frame outside this file: keeps the location of test.step() calls that pass none themselves. */
function callerLocation(): StepLocation | undefined {
  // Frames look like "at fn (C:\dir\file.ts:12:5)", "at /dir/file.ts:12:5" or "at file:///dir/file.ts:12:5".
  const frame = /(?:\(|at )((?:file:\/\/\/?)?(?:[A-Za-z]:)?[^:()]+):(\d+):(\d+)\)?$/;
  for (const line of (new Error().stack ?? '').split('\n').slice(1)) {
    const m = frame.exec(line.trim());
    if (!m || /not-run\.ts|node_modules|^node:/.test(m[1])) continue;
    return { file: m[1].replace(/^file:\/\/\/?/, ''), line: Number(m[2]), column: Number(m[3]) };
  }
  return undefined;
}

/**
 * Wraps `test.step` of the given test type (once): Gherkin steps (playwright-bdd passes their location) get the
 * not-run steps after a failure; every other step runs as before, at its caller's location.
 */
export function listNotRunStepsAfterFailures(test: { step: unknown; info: () => TestInfo }): void {
  const run = test.step as StepFn & Record<string, unknown>;
  if (run.__notRun) return;
  const wrapped = async (title: string, body: (info: unknown) => unknown, options?: { location?: StepLocation }) => {
    if (!options?.location) return run(title, body, { ...options, location: callerLocation() });
    try {
      return await run(title, body, options);
    } catch (error) {
      const testInfo = test.info();
      const notRun = pending.get(testInfo) ?? [];
      pending.delete(testInfo);
      for (const step of notRun) {
        await run(step.title, (info) => (info as { skip: (reason?: string) => void }).skip(), {
          location: step.location,
        });
      }
      throw error;
    }
  };
  Object.assign(wrapped, run, { __notRun: true });
  test.step = wrapped;
}
