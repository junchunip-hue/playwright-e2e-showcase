import { expect, test, type APIResponse } from '@playwright/test';

/** A product defect the suite tracks: the rule it breaks, the status that rule requires, and what the API does today. */
export interface KnownDefect {
  /** One line for the report, e.g. "POST /products checks no role". */
  summary: string;
  /** Status the intended rule requires, e.g. 403. */
  intended: number;
  /** Status the pinned Toolshop answers today, e.g. 201. */
  today: number;
}

/**
 * Checks a response against a known product defect (Java twin: com.showcase.api.KnownDefect).
 *
 * - The API still behaves as `today`: passes, and the report shows a "known defect" annotation.
 * - The API behaves as `intended`: fails with "fixed", the signal to replace this call with a plain assertion.
 * - Anything else (401, 422, 500): fails like any assertion.
 *
 * Not test.fail(): that passes on *any* failure, so a broken arrange step or a server error would hide behind the
 * expected failure. Here only the exact defect keeps the test green.
 */
export function expectKnownDefect(res: APIResponse, label: string, defect: KnownDefect): void {
  test.info().annotations.push({ type: 'known defect', description: knownDefectLine(defect, label, res.status()) });
  expect(
    res.status(),
    `known defect fixed: ${label} now answers ${defect.intended}. Replace expectKnownDefect with a plain assertion.`,
  ).not.toBe(defect.intended);
  expect(res.status(), `${label}: neither today's behaviour (${defect.today}) nor the fix (${defect.intended})`).toBe(
    defect.today,
  );
}

/**
 * One line per check, read back by scripts/pipeline-summary.mjs (the Java twin prints the same line, prefixed with
 * "known defect: "): "<summary> | <label> | answered <status> (today <today>, intended <intended>)".
 */
export function knownDefectLine(defect: KnownDefect, label: string, status: number): string {
  return `${defect.summary} | ${label} | answered ${status} (today ${defect.today}, intended ${defect.intended})`;
}
