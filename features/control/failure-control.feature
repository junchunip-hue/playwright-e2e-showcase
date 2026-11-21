# Shared by both suites. The failure control (ADR 0013): it fails on purpose, at the same step, every night, so the
# reports always show what a failure looks like: the steps before it passed, the failing step with its error, and the
# steps after it reported as not run. It is not a product test: the nightly runs it in a separate step and leaves it
# out of the verdict, the badge and the clean streak. If it ever passes, the reporting of failures needs a look.
@control
Feature: Failure control
  Searches the catalogue for a term that has results, then wrongly expects none.

  Scenario: C1: a failing step stops the scenario, and the steps after it are reported as not run
    Given the first product of the catalogue list
    When I search the API for "pliers"
    Then the result is an empty paginator
    And searching for its name finds it
