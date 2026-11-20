# Shared by both suites: TypeScript (playwright-bdd, src/steps/api/) and Java (Cucumber-JVM, com.showcase.steps.api).
Feature: Products API
  The catalogue list is paginated; field names and types are checked by the contracts (A0).

  @smoke
  Scenario: A1: GET /products returns a paginated, well-formed list
    When I request the first page of products
    Then it is page 1 with at least one and at most a page of products
