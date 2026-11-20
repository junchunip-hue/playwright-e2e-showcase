# Shared by both suites: TypeScript (playwright-bdd, src/steps/api/) and Java (Cucumber-JVM, com.showcase.steps.api).
# A0: every response is validated against its schema inside the API client (TS: src/api/schemas.ts, Java:
# api/Contracts.java), so each call below is a contract check; the steps check what a schema cannot.
Feature: API contracts
  Responses keep their contract: list, detail and search agree, an empty search is still a paginator, and a broken
  contract is reported with the field that broke it. Fresh customers are used, never the shared demo account.

  @smoke
  Scenario: A0: product list, product detail and search agree on the Product contract
    Given the first product of the catalogue list
    Then its detail has the same id, name and price
    And searching for its name finds it

  @smoke
  Scenario: A0: an empty search still returns a valid paginator
    When I search the API for "no-such-product-zz9"
    Then the result is an empty paginator

  @smoke
  Scenario: A0: login and invoice list for a new customer
    Given a newly registered customer
    Then that customer has no invoices

  @smoke
  Scenario: A0: postcode lookup returns a usable address
    When I look up the US postcode "90210"
    Then the address is in country "US" with postcode "90210"

  # The guard itself: a contract break is reported with the field path, not swallowed.
  @smoke
  Scenario: A0: rejects a retyped field and names it
    Given the first product of the catalogue list
    When its price is sent back as a string
    Then the contract check reports only the field "price"
