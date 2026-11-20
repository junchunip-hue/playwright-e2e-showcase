package com.showcase.steps.api;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microsoft.playwright.APIResponse;
import com.showcase.api.ApiClient;
import com.showcase.data.Payments;
import com.showcase.steps.PlaywrightContext;
import io.cucumber.java.en.Then;
import java.util.List;

/**
 * Steps layer for features/api/payments.feature (A9). One step covers every method or card, each a
 * separate check in the report. TypeScript twin: src/steps/api/payments.steps.ts.
 */
public class PaymentsApiSteps {
  private final PlaywrightContext playwright;

  public PaymentsApiSteps(PlaywrightContext playwright) {
    this.playwright = playwright;
  }

  @Then("the payment check accepts every payment method with valid details")
  public void thePaymentCheckAcceptsEveryMethod() {
    ApiClient api = playwright.api();
    assertAll(
        Payments.allMethods().stream()
            .map(p -> () -> assertDoesNotThrow(() -> api.checkPayment(p), p.method())));
  }

  @Then("the payment check rejects each invalid card, naming only its broken field")
  public void thePaymentCheckRejectsEachInvalidCard() {
    ApiClient api = playwright.api();
    assertAll(
        Payments.invalidCards().stream()
            .map(card ->
                () -> {
                  APIResponse res = api.paymentCheckRequest(card.payment());
                  assertEquals(422, res.status(), card.name());
                  assertEquals(
                      List.of("payment_details." + card.field()),
                      api.paymentRejectedFields(res),
                      card.name());
                }));
  }
}
