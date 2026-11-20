# Shared by both suites: TypeScript (playwright-bdd, src/steps/api/) and Java (Cucumber-JVM, com.showcase.steps.api).
# The catalogue filters at API level (the UI's checkboxes, price slider and sort select call the same query). Every
# check is an invariant over the whole result, not a fixed count, so it holds on the public demo too. Category and
# brand come from the first listed product, so each filter has a match. Results are paged (9 per page).
@regression
Feature: Product filters API

  Scenario: A7: a category or brand filter returns only products of it
    Given the first product of the catalogue list
    Then filtering by its category returns only products of that category
    And filtering by its brand returns only products of that brand

  Scenario: A7: a price range returns only prices inside it, both ends included
    Given the first product of the catalogue list
    Then filtering by prices from 10 to 20 returns only prices inside that range
    And filtering by exactly its price finds it

  # Two pages: the order must hold across the page boundary, not only within one page.
  Scenario Outline: A7: sorting by <by> <order> orders the result across pages
    When I request two pages sorted by <by> <order>
    Then the products are in that order across both pages

    Examples:
      | by    | order |
      | price | asc   |
      | price | desc  |
      | name  | asc   |
      | name  | desc  |

  Scenario: A7: brand, price range and sort combine
    Given the first product of the catalogue list
    Then filtering by its brand, prices up to its own and price descending finds it, matching every filter
