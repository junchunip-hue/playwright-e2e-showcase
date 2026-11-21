# Shared by both suites. Failure control C2, a UI test (ADR 0013): it fails on purpose, at the same step, every night,
# so the reports always show what a UI failure looks like: the steps before it passed, the failing step with its error
# and a screenshot of the page at that moment, and the steps after it reported as not run. It is not a product test:
# the nightly runs it in a separate step and leaves it out of the verdict, the badge and the clean streak. If it ever
# passes, the reporting of failures needs a look.
@control
@logged-out
Feature: Failure control, UI (fails on purpose, not counted)
  Opens the catalogue and wrongly expects its first product to be a hammer before searching (step 2 waits for the
  products, then fails with a screenshot of the catalogue as it was), so the two steps after it, which search first and
  then check, are reported as not run.

  Scenario: C2: a UI step fails with a screenshot, and the steps after it are reported as not run
    Given I open the catalogue page
    Then the first product shown has "hammer" in its name
    When I search the catalogue page for "hammer"
    Then the first product shown has "hammer" in its name
