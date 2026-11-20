# Shared by both suites: TypeScript (playwright-bdd, src/steps/api/) and Java (Cucumber-JVM, com.showcase.steps.api).
# Known product defects, tracked as tests (ADR 0010): green while the API answers exactly as today, red once it is
# fixed (replace the step with a plain assertion) or answers anything else. Found while building S3 (test plan).
@admin
Feature: Permissions API
  Admin actions must be refused to customers; the pinned Toolshop does not refuse them. These scenarios can change
  catalogue and orders while the defects exist, so our own Toolshop only.

  @smoke @negative
  Scenario: A10: a customer cannot publish a product
    Given a newly registered customer
    When that customer tries to publish a product through the API
    Then the API still answers 201 instead of 403, known defect "POST /products checks no role" for "POST /products as a customer"

  # The customer sends the status the order already has, so the request changes nothing even while the defect exists.
  @smoke @negative
  Scenario: A11: a customer cannot change the status of an order
    Given an order of someone else, in a status the API accepts
    And a newly registered customer
    When that customer sets that order to the status it already has
    Then the API still answers 200 instead of 403, known defect "PUT /invoices/{id}/status checks neither role nor ownership" for "PUT /invoices/{id}/status as another customer"
    And the order is unchanged
