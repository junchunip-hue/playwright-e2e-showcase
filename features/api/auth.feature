# Shared by both suites: TypeScript (playwright-bdd, src/steps/api/) and Java (Cucumber-JVM, com.showcase.steps.api).
Feature: Auth API
  Signing in through the API returns a token; a wrong password is refused.

  @smoke
  Scenario: A2: valid credentials return an access token
    When the demo customer signs in through the API
    Then an access token is returned

  # Throwaway account: failed logins count towards an account lock (HTTP 423) on the shared customer.
  @regression
  @negative
  Scenario: A3: wrong password is rejected with 401
    Given a newly registered customer
    When that customer signs in through the API with a wrong password
    Then the API answers 401
