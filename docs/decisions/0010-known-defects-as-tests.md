# 0010 – Known product defects are tracked as tests

**Status:** Accepted

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
- The API answers today's status: the test passes, and the report shows a `known defect` annotation.
- The API answers the intended status: the test fails with "known defect fixed", and the marker is then replaced by a
  plain assertion.
- The API answers anything else: the test fails like any assertion.

Requests that would change data while the defect exists are made harmless where possible: A11 sets an order to the
status it already has. A10 creates a product, so both run against our own Toolshop only (`@admin`).

**Consequences:**
- Findings stay visible in every run (PR gate and nightly) without turning CI red.
- Upgrading the pinned Toolshop to a version with the fix fails the PR that upgrades it, so the fix is noticed and the
  test is turned into a normal negative test in the same change.
- Positive controls stay separate: A8 and S3 send the same requests as the admin, so a broken payload fails there.
