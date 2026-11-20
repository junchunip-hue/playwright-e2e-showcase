import { AfterStep } from '../fixtures';

/**
 * When a Gherkin step fails, the steps after it do not run, and Playwright's report would simply not show them. This
 * hook lists them, so every failed scenario reads as passed steps, one failed step, and the steps that were not run:
 *
 * - each step after the failed one becomes a skipped sub-step "⏭ Not run: <step>" of the failed step;
 * - the test gets two annotations, read by scripts/pipeline-summary.mjs: "failed step" (the step, with its keyword)
 *   and "not run" (the steps after it, one per line).
 *
 * Java needs no hook: Cucumber-JVM reports the steps after a failure as skipped (report/ScenarioLog).
 */
AfterStep(async ({ $step, $bddContext, $test, $testInfo }) => {
  if ($step.error === undefined) return;
  const steps = $bddContext.bddTestData.steps.map((s) => s.textWithKeyword);
  const failed = steps[$bddContext.stepIndex];
  const notRun = steps.slice($bddContext.stepIndex + 1);
  $testInfo.annotations.push({ type: 'failed step', description: failed });
  if (notRun.length) $testInfo.annotations.push({ type: 'not run', description: notRun.join('\n') });
  for (const step of notRun) await $test.step(`⏭ Not run: ${step}`, (s) => s.skip());
});
