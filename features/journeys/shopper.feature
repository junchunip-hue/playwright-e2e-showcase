# Shared by both suites: TypeScript (playwright-bdd, src/steps/) and Java (Cucumber-JVM, com.showcase.steps).
# The PDF is written by a background job after the order (Toolshop's scheduler; CI runs it, see
# .github/actions/toolshop-ready), so this journey also waits on asynchronous work: @timeout:300000 (5 minutes).
# The public demo started that job but did not finish a PDF in 4 minutes (2026-11-19): own Toolshop only.
@logged-out
@own-toolshop
Feature: Returning customer
  A customer who signs in first and shops around before buying: a favourite, a side-by-side comparison, then the
  order and its invoice as a PDF download.

  @regression
  @e2e
  @timeout:300000
  Scenario: S5: a returning customer saves a favourite, compares two products, buys the cheaper one and downloads the invoice
    Given a newly registered customer
    And two different products that are in stock
    And I have signed in as that customer on the login page
    When I add the first product to my favourites on its product page
    Then my favourites list only the first product
    When I compare both products
    Then the comparison shows both products at their catalogue prices
    When I choose the cheaper of the two products
    And I open that product's page
    And I add it to the cart on the product page
    Then the cart badge shows 1
    When I review the cart
    And I continue as the signed-in customer
    And I confirm my saved billing address
    And I pay with "cash-on-delivery"
    And I download the invoice as a PDF
    Then the file is a PDF named after the invoice
    And the backend has the favourite, the order at the cart total and a completed PDF
