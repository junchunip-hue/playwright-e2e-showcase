import { type APIResponse, expect, test } from '@playwright/test';

/** A product defect the suite tracks: the rule it breaks, the status that rule requires, and what the API does today. */
export interface KnownDefect {
  /** One line for the report, e.g. "POST /products checks no role". */
  summary: string;
  /** Status the intended rule requires, e.g. 403. */
  intended: number;
  /** Status the pinned Toolshop answers today, e.g. 201. */
  today: number;
}

/** Where the defect shows: the Gherkin step that fails, and the steps after it, which then do not run. */
export interface DefectStep {
  /** The failing step, with its keyword, e.g. 'Then the API should answer 403 for …'. */
  failing: string;
  /** The steps after it, with their keywords. */
  notRun: string[];
}

/**
 * Asserts the intended rule at the step where a known product defect shows (ADR 0010; Java twin:
 * com.showcase.api.KnownDefect). Each step of the scenario ends in one of three states:
 *
 * - **Pass:** the steps before this one.
 * - **Fail:** this step, while the API still answers exactly as `today`. The test is marked as an expected failure
 *   (`test.fail`), so the run stays green, but the step is red in the report with "expected <intended>, received
 *   <today>", and the "known defect" annotation names it.
 * - **Skipped:** the steps after it. They do not run, like after any failing step; the report lists each of them as a
 *   skipped sub-step "⏭ Not run: …" of the failing step, and the annotation counts them.
 *
 * Any other answer is a real failure, not an expected one: the intended status means the defect is fixed (replace
 * this call with a plain assertion), and anything else (401, 422, 500) means something else broke. Only the exact
 * defect is ever marked as expected, so `test.fail` cannot hide another problem.
 */
export async function expectKnownDefect(
  res: APIResponse,
  label: string,
  defect: KnownDefect,
  where: DefectStep,
): Promise<void> {
  const status = res.status();
  test.info().annotations.push({ type: 'known defect', description: knownDefectLine(defect, label, status, where) });
  // Two guards, shown as sub-steps of this step: they pass while the defect is exactly as known. Their messages are
  // what a reader sees in the report, and the failure text when the defect is fixed or something else broke.
  expect(
    status,
    `Defect still present: ${label} does not answer ${defect.intended} yet (if it does, the defect is fixed: replace expectKnownDefect with a plain assertion)`,
  ).not.toBe(defect.intended);
  expect(
    status,
    `Answer unchanged: ${label} answers ${defect.today} as known (anything else, neither ${defect.today} nor ${defect.intended}, is a new problem)`,
  ).toBe(defect.today);

  // Exactly the known defect: from here on this test is an expected failure.
  const notRun = where.notRun.length ? `; ${where.notRun.length} step(s) after it not run` : '';
  test.fail(true, `Known defect "${defect.summary}": fails on purpose at "${where.failing}"${notRun}`);
  for (const step of where.notRun) await test.step(`⏭ Not run: ${step}`, (s) => s.skip());
  expect(status, `Fails on purpose, known defect "${defect.summary}": ${label} should answer ${defect.intended}`).toBe(
    defect.intended,
  );
}

/**
 * One line per check, read back by scripts/pipeline-summary.mjs (the Java twin prints the same line, prefixed with
 * "known defect: "):
 * "<summary> | <label> | answered <status> (today <today>, intended <intended>) | fails at: <step> | not run: <n>".
 */
export function knownDefectLine(defect: KnownDefect, label: string, status: number, where: DefectStep): string {
  return (
    `${defect.summary} | ${label} | answered ${status} (today ${defect.today}, intended ${defect.intended})` +
    ` | fails at: ${where.failing} | not run: ${where.notRun.length}`
  );
}
