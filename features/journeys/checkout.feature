# Shared by both suites: TypeScript (playwright-bdd, src/steps/) and Java (Cucumber-JVM, com.showcase.steps).
# Journey pattern: arrange through the API (Given), act in the UI (When), assert in the UI and the API (Then).
@logged-out
Feature: Checkout
  A new customer buys a product through the 4-step wizard: cart, sign in, billing address, payment.
  The customer shops signed out and signs in during checkout.

  @smoke @e2e
  Scenario: U6: new customer buys an in-stock product with cash on delivery
    Given a newly registered customer
    And a product that is in stock
    When I add that product to the cart
    And I review the cart
    And I sign in as that customer during checkout
    And I confirm my saved billing address
    And I pay with "cash-on-delivery"
    Then that customer's invoice exists at the cart total
    And the invoice is billed to the customer's country

  # S2: every other payment method (cash on delivery is U6 itself).
  @regression @e2e
  Scenario Outline: S2: new customer pays with <method>
    Given a newly registered customer
    And a product that is in stock
    When I add that product to the cart
    And I review the cart
    And I sign in as that customer during checkout
    And I confirm my saved billing address
    And I pay with "<method>"
    Then that customer's invoice exists at the cart total

    Examples:
      | method            |
      | bank-transfer     |
      | credit-card       |
      | buy-now-pay-later |
      | gift-card         |

  # Each card breaks one rule; the form must flag that field, the API must reject it, and nothing is ordered.
  @regression @e2e @negative
  Scenario Outline: S2: <card> is blocked before payment and creates no invoice
    Given a newly registered customer
    And a product that is in stock
    When I add that product to the cart
    And I review the cart
    And I sign in as that customer during checkout
    And I confirm my saved billing address
    And I enter the payment details of a "<card>"
    Then the form flags that card's invalid field and cannot be submitted
    And the payment API rejects those details for that field only
    And that customer has no invoices

    Examples:
      | card                  |
      | malformed card number |
      | expired card          |
