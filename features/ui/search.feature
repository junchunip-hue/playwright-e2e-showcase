# Shared by both suites: TypeScript (playwright-bdd, src/steps/) and Java (Cucumber-JVM, com.showcase.steps).
Feature: Product search
  Searching the catalogue by name, on the landing page.

  @smoke
  Scenario: U3: every result matches the search term
    Given I open the catalogue page
    When I search the catalogue page for "pliers"
    Then every product shown has "pliers" in its name

  # Hybrid check: the UI must show what the backend returns (catches frontend filtering bugs).
  @regression
  Scenario: U4: UI results are consistent with the search API
    Given the search API's results for "hammer"
    And I open the catalogue page
    When I search the catalogue page for "hammer"
    Then every product shown is one the search API returned
