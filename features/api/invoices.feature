# Shared by both suites: TypeScript (playwright-bdd, src/steps/api/) and Java (Cucumber-JVM, com.showcase.steps.api).
# Each request is sent twice, without and with a valid token: the anonymous one is refused with 401, the signed-in one
# reaches the lookup. That contrast shows the 401 comes from the missing token, not from the id. The ids do not exist
# (authentication is checked first), so no order is needed and nobody's data is read.
Feature: Invoices API: authentication

  @smoke
  @negative
  Scenario: A6: invoices cannot be read without a token
    Given a newly registered customer
    Then every invoice route refuses an anonymous request with 401 and lets the signed-in one through
      | route                                      | signed in |
      | GET /invoices                              | 200       |
      | GET /invoices/{id}                         | 404       |
      | GET /invoices/{number}/download-pdf        | 404       |
      | GET /invoices/{number}/download-pdf-status | 400       |

  @regression
  @negative
  Scenario: A6: a malformed token is refused like a missing one
    When I list invoices with the token "not-a-jwt"
    Then the API answers 401 Unauthorized
