import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, Tag, test } from '../../src/fixtures';
import { allSteps, compositeActions, findCycle, pushesCommits, ROOT, selfTriggerRisks, workflows } from './repo';

// Architecture rules for the CI pipeline: nothing can trigger itself, call itself, or run without a bound.
// Each rule names the offending file so a failure is actionable. Runs in the PR static stage (no Toolshop needed).

const MAX_JOB_MINUTES = 60;

test.describe('Pipeline architecture', { tag: [Tag.smoke, Tag.architecture] }, () => {
  test('every local action reference points to an existing action', () => {
    const missing = allSteps()
      .filter(({ step }) => step.uses?.startsWith('./'))
      .filter(({ step }) => !existsSync(join(ROOT, step.uses!, 'action.yml')))
      .map(({ where, step }) => `${where}: ${step.uses}`);

    expect(missing, 'missing local actions').toEqual([]);
  });

  test('composite actions do not call each other in a cycle', () => {
    const graph = new Map(
      compositeActions().map((a) => [a.ref, a.steps.flatMap((s) => (s.uses?.startsWith('./') ? [s.uses] : []))]),
    );

    expect(findCycle(graph), 'composite action cycle').toBeNull();
  });

  test('workflow_run triggers do not form a cycle', () => {
    // Edge: triggering workflow → triggered workflow.
    const graph = new Map<string, string[]>(workflows().map((w) => [w.name, []]));
    for (const w of workflows()) {
      const sources = (w.on.workflow_run as { workflows?: string[] } | undefined)?.workflows ?? [];
      for (const source of sources) graph.set(source, [...(graph.get(source) ?? []), w.name]);
    }

    expect(findCycle(graph), 'workflow_run cycle').toBeNull();
  });

  test('no step starts or re-runs a workflow', () => {
    // A workflow that dispatches workflows is how pipelines recurse; this repo needs none.
    const offenders = allSteps()
      .filter(({ step }) => /gh\s+(workflow\s+run|run\s+rerun)|\/dispatches\b|repository_dispatch/.test(step.run ?? ''))
      .map(({ where, step }) => `${where}: ${step.name ?? step.run?.split('\n')[0]}`);

    expect(offenders, 'steps that trigger workflows').toEqual([]);
  });

  test('workflows that push commits cannot trigger themselves', () => {
    const pushing = workflows().filter(pushesCommits);

    // The baseline workflow is the one that pushes; if it ever stops, this rule silently checks nothing.
    expect(pushing.map((w) => w.file)).toContain('.github/workflows/update-visual-baselines.yml');
    expect(pushing.flatMap(selfTriggerRisks), 'self-triggering risks').toEqual([]);
  });

  test(`every job has a timeout of at most ${MAX_JOB_MINUTES} minutes`, () => {
    const problems = workflows().flatMap((w) =>
      Object.entries(w.jobs)
        .filter(([, job]) => !(job['timeout-minutes'] && job['timeout-minutes'] <= MAX_JOB_MINUTES))
        .map(([id, job]) => `${w.file} › ${id}: timeout-minutes = ${job['timeout-minutes'] ?? 'missing'}`),
    );

    expect(problems, 'jobs without a bounded timeout').toEqual([]);
  });

  test('shell scripts only use bounded loops', () => {
    // Waits are written as `for i in $(seq 1 N)`; while/until loops can spin until the job timeout.
    const offenders = allSteps()
      .filter(({ step }) => /(^|[;\s])(while|until)\s/m.test(step.run ?? ''))
      .map(({ where, step }) => `${where}: ${step.name ?? 'unnamed step'}`);

    expect(offenders, 'unbounded shell loops').toEqual([]);
  });
});
