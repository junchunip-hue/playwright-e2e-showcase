# 0013 – A failing test stays a failure, and the report shows the step where it failed

**Status:** Accepted (supersedes [0010](0010-known-defects-as-tests.md))

**Context:** A10 and A11 found two authorization defects in the pinned Toolshop (a customer can publish a product
and change any order's status). ADR 0010 kept them as tests that passed while the defect was exactly as known; a later
version let the defect step fail on purpose and counted the test as a "known defect". Both made a defect look
acceptable in the reports, needed special step sentences and code in both languages, and would not scale: with more
such entries, a green run would mean less and less. Separately, a failed scenario showed only its failing step: the
steps after it, which never ran, did not appear in the TypeScript report at all.

**Options considered:**
- Keep a known-defect marker (ADR 0010, or an expected failure per step): rejected for the reasons above.
- Keep A10/A11 as plain tests that expect 403: they would fail on every run, and as smoke tests block every PR.
- **Remove A10/A11, and make every failure readable step by step** (chosen).

**Decision:**
- There are no "known issue" markers and no expected failures. A test in the suite must pass. When it fails, either
  the test is wrong (fix the test) or the product is wrong (fix the product); the test is not marked as tolerated.
- A10 and A11 are removed: the defect is in Toolshop, an upstream project this suite tests but does not change. Their
  test-plan rows stay (status ✖ removed, IDs not reused) with the findings, and they come back as plain negative tests
  if the pinned Toolshop is upgraded to a version with the permission checks.
- Every failed scenario reads as Gherkin does: the steps before the failure passed, one step failed, and every step
  after it was not run.
  - TypeScript: `src/steps/not-run.hooks.ts` (an `AfterStep` hook) lists each remaining step as a skipped sub-step
    "⏭ Not run: …" of the failed step and adds two annotations, `failed step` and `not run`.
  - Java: Cucumber already reports the remaining steps as skipped; `ScenarioLog` keeps every step with its status and
    the failed step's error.
  - The run summary and the results page list every failed test with its failed step, its error and the steps that
    did not run; the Java results page marks each step `[failed]` or `[not run]`.

**Failure control (added 2026-11-21):** one scenario, C1 (`features/control`, tier `@control`), fails on purpose at
the same step every night, in both languages, so the reports always show a real failure next to the passing suite: the
passed steps, the failed step with its error and the steps not run. It is not a product test and not an expected
failure: it runs in a separate nightly step (`continue-on-error`) after the regression run, is excluded from every other
suite and Maven run, and the summary leaves it out of the verdict, the counts, the badge and the clean streak, listing
it in its own "Failure control" section. If it ever passes, the reporting of failures is broken.

**Consequences:**
- A red run always means something to fix, and the reports say exactly where: which step, which error, which steps
  never ran.
- Findings the suite cannot act on (an upstream defect) are recorded in the test plan, not in the suite.
- playwright-bdd 10 (in pre-release) can skip a step from a hook, which would show the not-run steps at the top level
  of the TypeScript report instead of under the failed step; worth adopting once it is released.
