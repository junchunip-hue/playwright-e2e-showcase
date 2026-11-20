# Shared by both suites: TypeScript (playwright-bdd, src/steps/) and Java (Cucumber-JVM, com.showcase.steps).
@logged-out
@admin
Feature: Guest checkout
  The second way into checkout: a guest never registers. The guest tab takes email and name, the postcode lookup
  fills the address (nothing is prefilled for a guest), and the order goes to POST /invoices/guest. A guest invoice
  belongs to no user, so only the admin can look it up afterwards: our own Toolshop only.

  @regression
  @e2e
  Scenario: S4: a guest buys without an account and the order exists at the cart total
    Given guest details that were never registered
    And a product that is in stock
    When I add that product to the cart
    And I review the cart
    And I continue as that guest
    And I enter the guest's billing address for the postcode lookup
    And I pay with "cash-on-delivery"
    Then the admin finds the order at the cart total
    And the order is billed to the guest's address
