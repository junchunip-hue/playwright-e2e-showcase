# Shared by both suites: TypeScript (playwright-bdd, src/steps/api/) and Java (Cucumber-JVM, com.showcase.steps.api).
# Rules of POST /users/register (pinned source: StoreCustomer request). Each scenario breaks exactly one rule on
# otherwise valid data and checks that only that field is reported.
Feature: Registration API

  @smoke
  @negative
  Scenario: A4: weak password is rejected with every unmet rule
    When I register a new customer with the password "abc"
    Then the API answers 422
    And only the password is rejected, for every unmet rule

  # The leak check calls the external Have I Been Pwned API from the Toolshop backend; Laravel lets the password
  # through when that service is unreachable. External dependency, so nightly rather than the PR gate.
  @regression
  @negative
  Scenario: A4: password from a known data leak is rejected
    When I register a new customer with the password "Password1!"
    Then the API answers 422
    And only the password is rejected, as having appeared in a data leak

  # Toolshop answers 409 Conflict here, not 422: the duplicate is a state conflict, not malformed input.
  @smoke
  @negative
  Scenario: A5: duplicate email is rejected with 409
    Given a newly registered customer
    When I register another customer with the same email
    Then the API answers 409
    And only the email is rejected, as already existing
