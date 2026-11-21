import { AfterStep } from '../fixtures';
import { screenshotFailedStep } from '../fixtures/evidence';
import { rememberNotRun } from '../fixtures/not-run';

/**
 * When a Gherkin step fails, the steps after it do not run. This hook, which runs inside the failed step, hands them to
 * the test.step wrapper (src/fixtures/not-run.ts); once the failed step has ended, the wrapper lists each of them right
 * after it, at the same level, as a skipped step with its own text and location. So every failed scenario reads as
 * passed steps, one failed step, and the steps that were not run.
 *
 * It also annotates the test, for scripts/pipeline-summary.mjs: "failed step" (the step, with its keyword) and
 * "not run" (the steps after it, one per line).
 *
 * Java needs no hook: Cucumber-JVM reports the steps after a failure as skipped (report/ScenarioLog).
 */
AfterStep(async ({ $step, $bddContext, $testInfo }) => {
  if ($step.error === undefined) return;
  const steps = $bddContext.bddTestData.steps;
  const failed = steps[$bddContext.stepIndex];
  // Evidence first, while the page still shows the failure: attached to this (the failed) step.
  await screenshotFailedStep($testInfo, failed.textWithKeyword);
  const notRun = steps.slice($bddContext.stepIndex + 1);
  $testInfo.annotations.push({ type: 'failed step', description: failed.textWithKeyword });
  if (notRun.length)
    $testInfo.annotations.push({ type: 'not run', description: notRun.map((s) => s.textWithKeyword).join('\n') });
  rememberNotRun(
    $testInfo,
    notRun.map((s) => ({
      title: s.textWithKeyword,
      location: { file: $testInfo.file, line: s.pwStepLine, column: 5 },
    })),
  );
});
