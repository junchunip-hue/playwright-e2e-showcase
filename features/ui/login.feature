# Shared by both suites: TypeScript (playwright-bdd, src/steps/) and Java (Cucumber-JVM, com.showcase.steps).
# Every scenario name starts with its test-plan ID; tags give its tier (@smoke runs on every PR).
@logged-out
Feature: Login
  A customer signs in with email and password. These scenarios start signed out.

  @smoke
  Scenario: U1: customer can log in with valid credentials
    Given I open the login page
    When I sign in as the demo customer on the login page
    Then I am on my account page
    And the header shows my user menu

  # Failed logins count towards an account lock (HTTP 423), so this uses a throwaway customer:
  # repeated runs must never lock the shared demo customer that other scenarios sign in with.
  @smoke
  @negative
  Scenario: U2: shows an error for a wrong password
    Given a newly registered customer
    And I open the login page
    When I sign in as that customer with a wrong password on the login page
    Then I see a login error
    And I am still on the login page
