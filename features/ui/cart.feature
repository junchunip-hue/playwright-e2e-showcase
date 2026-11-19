# Shared by both suites: TypeScript (playwright-bdd, src/steps/) and Java (Cucumber-JVM, com.showcase.steps).
@logged-out
Feature: Cart
  A signed-in customer adds a product to the cart and the header's cart badge counts it.

  # Hybrid setup: the API picks a product that is in stock right now, so the scenario does not break when the
  # shop's inventory changes.
  @smoke
  Scenario: U5: adding a product updates the cart badge
    Given a product that is in stock
    And I am signed in as the demo customer
    When I open that product's page
    Then the page shows that product
    When I add it to the cart
    Then the cart badge shows 1
