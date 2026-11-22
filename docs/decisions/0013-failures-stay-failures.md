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
  - TypeScript: an `AfterStep` hook (`src/steps/not-run.hooks.ts`) and a wrapper around `test.step`
    (`src/fixtures/not-run.ts`) list each remaining Gherkin step right after the failed one, at the same level, as a
    skipped step with its own text; the test gets two annotations, `failed step` and `not run`.
  - Java: Cucumber already reports the remaining steps as skipped; `ScenarioLog` keeps every step with its status and
    the failed step's error, and the Java report adds the same `failed step` and `not run` annotations.
  - The run summary and the results page list every failed test with its failed step, its error and the steps that
    did not run. The Java report is a Playwright HTML report too (`scripts/java-report.mjs`), so it shows a failure
    exactly like the TypeScript one.

**Failure controls (added 2026-11-21):** two scenarios (`features/control`, tier `@control`) fail on purpose at the
same step every night, in both languages, so the reports always show real failures next to the passing suite: the
passed steps, the failed step with its error and the steps not run. C1 is an API failure (no page, no screenshot); C2 a
UI failure, whose failed step carries the full-page screenshot taken at that moment (a click on it in either report
opens it enlarged, with a download button). They are not product tests and not expected
failures: they run in a separate nightly step (`continue-on-error`) after the regression run, are excluded from every
other suite and Maven run, and the summary leaves them out of the verdict, the counts, the badge and the clean streak,
listing them in their own "Failure controls" section. If one ever passes, the reporting of failures is broken.

**Evidence of a failure (added 2026-11-22), the same in both languages:**
- A failed UI step carries a full-page screenshot taken at that step (`src/fixtures/evidence.ts`, Java `Hooks`), the
  sign-in setup included; a failed browser test also keeps its Playwright trace (TypeScript: the first retry's, or the
  failed run's for the controls; Java: every failed attempt's). A trace's thumbnail in the report opens the trace viewer.
- An API test opens no page: no screenshot and no trace. Its error states what was expected and what came back, which a
  trace of an empty page would only repeat. Java opens the browser on a scenario's first page use, so its API
  scenarios record none either.
- Playwright's own `error-context.md` is left out of the reports (`src/reporters/no-error-context.ts`): the
  screenshot is the evidence. TypeScript also keeps a video of a failed UI test; Java records none.

**Consequences:**
- A red run always means something to fix, and the reports say exactly where: which step, which error, which steps
  never ran.
- Findings the suite cannot act on (an upstream defect) are recorded in the test plan, not in the suite.
- playwright-bdd 10 (in pre-release) can skip a step from a hook; once it is released, the `test.step` wrapper can be
  replaced by that.
