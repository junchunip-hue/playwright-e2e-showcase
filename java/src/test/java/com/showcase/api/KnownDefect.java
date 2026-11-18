package com.showcase.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import com.microsoft.playwright.APIResponse;

/**
 * A product defect the suite tracks (Java twin of src/known-defects.ts): the rule it breaks, the status that rule
 * requires, and what the pinned Toolshop answers today.
 *
 * <ul>
 *   <li>The API still behaves as {@code today}: passes, and the defect is printed (kept in the Surefire XML).
 *   <li>The API behaves as {@code intended}: fails with "fixed", the signal to replace this call with a plain assertion.
 *   <li>Anything else (401, 422, 500): fails like any assertion.
 * </ul>
 */
public record KnownDefect(String summary, int intended, int today) {

  public void check(APIResponse res, String label) {
    // Read back from the Surefire XML (<system-out>) by scripts/pipeline-summary.mjs; same line as the TS annotation.
    System.out.printf("known defect: %s | %s | answered %d (today %d, intended %d)%n", summary, label, res.status(), today, intended);
    assertNotEquals(intended, res.status(),
        "known defect fixed: " + label + " now answers " + intended + ". Replace KnownDefect with a plain assertion.");
    assertEquals(today, res.status(),
        label + ": neither today's behaviour (" + today + ") nor the fix (" + intended + ")");
  }
}
