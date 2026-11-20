import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { expect, Tag, test } from '../../src/fixtures';
import { allSteps, compositeActions, findCycle, pushesCommits, ROOT, selfTriggerRisks, workflows } from './repo';

// Architecture rules for the CI pipeline: nothing can trigger itself, call itself, or run without a bound.
// Each rule names the offending file so a failure is actionable. Runs in the PR static stage (no Toolshop needed).

const MAX_JOB_MINUTES = 60;

test.describe('Pipeline architecture', { tag: [Tag.smoke, Tag.architecture] }, () => {
  test('N3: every local action reference points to an existing action', () => {
    const missing = allSteps()
      .filter(({ step }) => step.uses?.startsWith('./'))
      .filter(({ step }) => !existsSync(join(ROOT, step.uses!, 'action.yml')))
      .map(({ where, step }) => `${where}: ${step.uses}`);

    expect(missing, 'missing local actions').toEqual([]);
  });

  test('N3: composite actions do not call each other in a cycle', () => {
    const graph = new Map(
      compositeActions().map((a) => [a.ref, a.steps.flatMap((s) => (s.uses?.startsWith('./') ? [s.uses] : []))]),
    );

    expect(findCycle(graph), 'composite action cycle').toBeNull();
  });

  test('N3: workflow_run triggers do not form a cycle', () => {
    // Edge: triggering workflow → triggered workflow.
    const graph = new Map<string, string[]>(workflows().map((w) => [w.name, []]));
    for (const w of workflows()) {
      const sources = (w.on.workflow_run as { workflows?: string[] } | undefined)?.workflows ?? [];
      for (const source of sources) graph.set(source, [...(graph.get(source) ?? []), w.name]);
    }

    expect(findCycle(graph), 'workflow_run cycle').toBeNull();
  });

  test('N3: no step starts or re-runs a workflow', () => {
    // A workflow that dispatches workflows is how pipelines recurse; this repo needs none.
    const offenders = allSteps()
      .filter(({ step }) => /gh\s+(workflow\s+run|run\s+rerun)|\/dispatches\b|repository_dispatch/.test(step.run ?? ''))
      .map(({ where, step }) => `${where}: ${step.name ?? step.run?.split('\n')[0]}`);

    expect(offenders, 'steps that trigger workflows').toEqual([]);
  });

  test('N3: workflows that push commits cannot trigger themselves', () => {
    const pushing = workflows().filter(pushesCommits);

    // The baseline workflow is the one that pushes; if it ever stops, this rule silently checks nothing.
    expect(pushing.map((w) => w.file)).toContain('.github/workflows/update-visual-baselines.yml');
    expect(pushing.flatMap(selfTriggerRisks), 'self-triggering risks').toEqual([]);
  });

  test(`N3: every job has a timeout of at most ${MAX_JOB_MINUTES} minutes`, () => {
    const problems = workflows().flatMap((w) =>
      Object.entries(w.jobs)
        .filter(([, job]) => !(job['timeout-minutes'] && job['timeout-minutes'] <= MAX_JOB_MINUTES))
        .map(([id, job]) => `${w.file} › ${id}: timeout-minutes = ${job['timeout-minutes'] ?? 'missing'}`),
    );

    expect(problems, 'jobs without a bounded timeout').toEqual([]);
  });

  test('N3: shell scripts only use bounded loops', () => {
    // Waits are written as `for i in $(seq 1 N)`; while/until loops can spin until the job timeout.
    const offenders = allSteps()
      .filter(({ step }) => /(^|[;\s])(while|until)\s/m.test(step.run ?? ''))
      .map(({ where, step }) => `${where}: ${step.name ?? 'unnamed step'}`);

    expect(offenders, 'unbounded shell loops').toEqual([]);
  });

  test('N3: every step that runs Playwright directly generates the Gherkin tests first', () => {
    // Without `bddgen`, the features (features/*.feature) would silently not run: only the npm scripts and
    // scripts/run-suite.mjs generate them on their own.
    const offenders = allSteps()
      .filter(({ step }) => /\bplaywright test\b/.test(step.run ?? '') && !/\bbddgen\b/.test(step.run ?? ''))
      .map(({ where, step }) => `${where}: ${step.name ?? step.run?.split('\n')[0]}`);

    expect(offenders, 'playwright test without bddgen').toEqual([]);
  });

  test('N3: browsers are installed only through the bounded, cached install action', () => {
    // A raw `playwright install --with-deps` (npx or the Java CLI) waits on the Ubuntu mirror without limit (once
    // 29 minutes). The install-browsers action caches the OS packages; its script caps each attempt and retries.
    const INSTALL_ACTION = '.github/actions/install-browsers/action.yml';
    const offenders = allSteps()
      .filter(({ where }) => where.replaceAll('\\', '/') !== INSTALL_ACTION)
      .filter(({ step }) => /playwright\s+install|install\s+--with-deps|install-browsers\.sh/.test(step.run ?? ''))
      .map(({ where, step }) => `${where}: ${step.name ?? step.run?.split('\n')[0]}`);

    expect(offenders, 'browser installs outside the install-browsers action').toEqual([]);
  });
});
