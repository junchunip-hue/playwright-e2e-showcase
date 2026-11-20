# Shared by both suites: TypeScript (playwright-bdd, src/steps/api/) and Java (Cucumber-JVM, com.showcase.steps.api).
# Known product defects, tracked as tests (ADR 0010). @known-defect marks each scenario; its known-defect step fails on
# purpose while the API answers exactly as today (the run stays green) and the steps after it do not run. Once the API
# answers as intended, the test fails: replace the step with a plain assertion. Found while building S3 (test plan).
@admin
Feature: Permissions API
  Admin actions must be refused to customers; the pinned Toolshop does not refuse them. These scenarios can change
  catalogue and orders while the defects exist, so our own Toolshop only.

  @smoke
  @negative
  @known-defect
  Scenario: A10: a customer cannot publish a product
    Given a newly registered customer
    When that customer tries to publish a product through the API
    Then the API should answer 403 for "POST /products as a customer", but answers 201 because of known defect "POST /products checks no role"

  # The customer sends the status the order already has, so the request changes nothing even while the defect exists.
  @smoke
  @negative
  @known-defect
  Scenario: A11: a customer cannot change the status of an order
    Given an order of someone else, in a status the API accepts
    And a newly registered customer
    When that customer sets that order to the status it already has
    Then the API should answer 403 for "PUT /invoices/{id}/status as another customer", but answers 200 because of known defect "PUT /invoices/{id}/status checks neither role nor ownership"
    And the order is unchanged
