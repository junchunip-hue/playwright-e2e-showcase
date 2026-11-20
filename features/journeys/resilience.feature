# Shared by both suites: TypeScript (playwright-bdd, src/steps/) and Java (Cucumber-JVM, com.showcase.steps).
# Network mocking: the browser's request is held back or answered with a 500 before it reaches Toolshop, and
# released again to show recovery (pages: network.page.ts / NetworkPage.java).
Feature: Resilience
  What a customer sees when the backend is slow or fails. Pinned behaviour: the app has no error state. A failed
  catalogue leaves the page blank, and a failed search shows "no results" (findings in docs/test-plan.md). These
  scenarios pin that, so a change is noticed.

  @regression
  Scenario: S6: a slow catalogue response still shows the products once it arrives
    Given the catalogue answers 3 seconds late
    When I open the product catalogue
    Then products are shown
    And no "no results" message is shown
    And the catalogue answer went through the delay

  @regression
  @negative
  Scenario: S6: a failed catalogue request shows no products and no error; a reload recovers
    Given the catalogue answers with a server error
    When I open the product catalogue
    Then the catalogue request got the server error
    And no products are shown
    And no "no results" message is shown
    When the catalogue works again and I reload the page
    Then products are shown

  @regression
  @negative
  Scenario: S6: a failed search is shown as "no results"; the next search works
    Given I am on the product catalogue
    And products are shown
    And the search answers with a server error
    When I submit a search for "pliers"
    Then a "no results" message is shown
    And no products are shown
    When the search works again and I search for "pliers"
    Then the first product shown has "pliers" in its name
