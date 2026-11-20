# 0010 – Known product defects are tracked as tests

**Status:** Superseded by [0013](0013-failures-stay-failures.md): no known-defect markers; A10 and A11 were removed
from the suite.

**Context:** Building S3 showed two authorization defects in the pinned Toolshop: a customer can publish a product,
and any signed-in user can change any order's status. A test that asserts the intended rule (403) would be red on
every run until upstream fixes it. Leaving it out loses the finding, and a permanently red test teaches people to
ignore red.

**Options considered:**
- `test.fail()` (Playwright): the test passes while it fails. But it passes on *any* failure, so a broken arrange
  step, an expired token (401) or a server error (500) would hide behind the expected failure. JUnit has no
  equivalent, so the two lanes would also differ.
- Document only: the defect is not checked, and nobody notices when it is fixed or gets worse.
- **Pin today's exact behaviour** (chosen).

**Decision:** A10 and A11 assert the intended rule through `expectKnownDefect` (`src/known-defects.ts`) and its Java
twin `KnownDefect` (`com.showcase.api`). Each defect states a summary, the intended status and today's status.
- The API answers today's status: the defect step **fails on purpose**. The steps before it passed, the steps after it
  do not run, as after any failure. TypeScript marks the test as an expected failure (`test.fail`, called only after
  the exact known answer is confirmed), shows the step red with "expected 403, received 201" and lists each later step
  as "⏭ Not run"; Java aborts the scenario, and the scenario log records that step as failed by the known defect and
  the later ones as skipped. Reports count the test as **known defect**, neither passed nor failed, and the run stays
  green.
- The API answers the intended status: the test fails with "known defect fixed", and the marker is then replaced by a
  plain assertion.
- The API answers anything else: the test fails like any assertion.

The feature says it up front: every scenario with a known-defect step carries `@known-defect`, and the step itself
names the intended answer, today's answer and the defect ("Then the API should answer 403 for …, but answers 201
because of known defect …"). `npm run check:steps` fails when the tag and the step do not go together.

*Revised 2026-11-21:* the first version let the defect step pass, so the report was all green and did not show where
the scenario breaks. A plain `test.fail()` was rejected because it accepts any failure; calling it only for the exact
known answer keeps that guarantee.

Requests that would change data while the defect exists are made harmless where possible: A11 sets an order to the
status it already has. A10 creates a product, so both run against our own Toolshop only (`@admin`).

**Consequences:**
- Findings stay visible in every run (PR gate and nightly) without turning CI red: the pipeline summary lists them in
  a "Known defects" table per language (🟨 still present, 🟥 fixed, ❌ unexpected), so a green run never hides them.
- Upgrading the pinned Toolshop to a version with the fix fails the PR that upgrades it, so the fix is noticed and the
  test is turned into a normal negative test in the same change.
- Positive controls stay separate: A8 and S3 send the same requests as the admin, so a broken payload fails there.
