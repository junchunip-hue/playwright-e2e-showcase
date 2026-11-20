# Shared by both suites: TypeScript (playwright-bdd, src/steps/api/) and Java (Cucumber-JVM, com.showcase.steps.api).
@admin
Feature: Admin API
  What an admin publishes is immediately part of the public catalogue, with valid references and stock. Uses the
  admin account and creates data, so it runs against our own Toolshop only.

  @smoke
  Scenario: A8: a product the admin publishes is listed, searchable and in stock
    When the admin publishes a new product through the API
    Then the product detail shows it in stock, with its brand and category
    And searching for its name finds only that product
