# Shared by both suites: TypeScript (playwright-bdd, src/steps/api/) and Java (Cucumber-JVM, com.showcase.steps.api).
# POST /payment/check, the server-side twin of the payment form (pinned PaymentController::check). The same payment
# data drives the UI journeys in features/journeys/checkout.feature (S2).
Feature: Payment check API

  @smoke
  Scenario: A9: accepts every payment method with valid details
    Then the payment check accepts every payment method with valid details

  @smoke
  @negative
  Scenario: A9: rejects an invalid card, naming only the broken field
    Then the payment check rejects each invalid card, naming only its broken field
