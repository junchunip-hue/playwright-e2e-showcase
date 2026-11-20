package com.showcase.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import com.microsoft.playwright.APIResponse;
import com.showcase.report.ScenarioLog;

/**
 * A product defect the suite tracks (Java twin of src/known-defects.ts): the rule it breaks, the
 * status that rule requires, and what the pinned Toolshop answers today.
 *
 * <ul>
 *   <li>The API still behaves as {@code today}: passes, and the defect is recorded for the pipeline
 *       summary.
 *   <li>The API behaves as {@code intended}: fails with "fixed", the signal to replace this call
 *       with a plain assertion.
 *   <li>Anything else (401, 422, 500): fails like any assertion.
 * </ul>
 */
public record KnownDefect(String summary, int intended, int today) {

  public void check(APIResponse res, String label) {
    // Same line as the TS annotation. Read back by scripts/pipeline-summary.mjs from the scenario
    // log (ScenarioLog),
    // and from the Surefire XML's <system-out> where that keeps it (locally; CI reruns drop it for
    // passed tests).
    String line =
        String.format(
            "known defect: %s | %s | answered %d (today %d, intended %d)",
            summary, label, res.status(), today, intended);
    System.out.println(line);
    ScenarioLog.note(line);
    assertNotEquals(
        intended,
        res.status(),
        "known defect fixed: "
            + label
            + " now answers "
            + intended
            + ". Replace KnownDefect with a plain assertion.");
    assertEquals(
        today,
        res.status(),
        label + ": neither today's behaviour (" + today + ") nor the fix (" + intended + ")");
  }
}
