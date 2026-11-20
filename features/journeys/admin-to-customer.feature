# Shared by both suites: TypeScript (playwright-bdd, src/steps/) and Java (Cucumber-JVM, com.showcase.steps).
@logged-out
@admin
Feature: Admin to customer
  Two roles in one journey: the admin works through the API, the customer through the UI (and checks their own
  order through their own token). Creates catalogue data, so it runs against our own Toolshop only.

  @regression
  @e2e
  Scenario: S3: admin publishes a product, a customer buys it, the admin ships it
    Given the admin has published a new product
    And a newly registered customer
    When I search the catalogue for that product
    Then the search shows only that product
    When I add that product to the cart
    And I review the cart
    And I sign in as that customer during checkout
    And I confirm my saved billing address
    And I pay with "cash-on-delivery"
    Then the admin finds the order at the cart total
    When the admin marks the order as shipped
    Then my invoices list shows the order
    And my own view of the order says it was shipped
