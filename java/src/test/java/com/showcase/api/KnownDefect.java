package com.showcase.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import com.microsoft.playwright.APIResponse;
import com.showcase.report.ScenarioLog;
import java.util.List;
import org.opentest4j.TestAbortedException;

/**
 * A product defect the suite tracks (Java twin of src/known-defects.ts): the rule it breaks, the
 * status that rule requires, and what the pinned Toolshop answers today. Each step of the scenario
 * ends in one of three states:
 *
 * <ul>
 *   <li><b>Pass:</b> the steps before the defect step.
 *   <li><b>Fail:</b> the defect step, while the API still answers exactly as {@code today}. JUnit
 *       has no expected failure, so the scenario is aborted (TestAbortedException: Surefire records
 *       it as skipped, the run stays green) and the scenario log marks this step as failed by the
 *       known defect. The pipeline summary counts the scenario as a known defect, not as skipped.
 *   <li><b>Skipped:</b> the steps after it. Cucumber does not run them, as after any failing step.
 * </ul>
 *
 * <p>Any other answer is a real failure: the intended status means the defect is fixed (replace
 * this call with a plain assertion), anything else (401, 422, 500) means something else broke.
 */
public record KnownDefect(String summary, int intended, int today) {

  public void check(APIResponse res, String label) {
    int status = res.status();
    String failing = ScenarioLog.currentStep();
    List<String> notRun = ScenarioLog.stepsAfterCurrent();
    // Same line as the TS annotation, read back by scripts/pipeline-summary.mjs from the scenario
    // log (ScenarioLog) and, locally, from the Surefire XML's <system-out>.
    String line =
        String.format(
            "known defect: %s | %s | answered %d (today %d, intended %d) | fails at: %s | not run: %d",
            summary, label, status, today, intended, failing, notRun.size());
    System.out.println(line);
    ScenarioLog.note(line);
    assertNotEquals(
        intended,
        status,
        "known defect fixed: "
            + label
            + " now answers "
            + intended
            + ". Replace KnownDefect with a plain assertion.");
    assertEquals(
        today,
        status,
        label + ": neither today's behaviour (" + today + ") nor the fix (" + intended + ")");

    // Exactly the known defect: this step fails on purpose and the steps after it do not run.
    ScenarioLog.markKnownDefectFailure();
    throw new TestAbortedException(
        String.format(
            "known defect \"%s\": %s should answer %d, answers %d. Fails on purpose at \"%s\"; %d"
                + " step(s) after it not run",
            summary, label, intended, status, failing, notRun.size()));
  }
}
