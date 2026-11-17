package com.showcase.tests;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microsoft.playwright.APIResponse;
import com.microsoft.playwright.Playwright;
import com.showcase.annotations.Negative;
import com.showcase.annotations.SmokeTest;
import com.showcase.annotations.ToolshopTest;
import com.showcase.api.ApiClient;
import com.showcase.data.Payments;
import java.util.List;
import org.junit.jupiter.api.DisplayName;

/** Mirrors tests/api/payments.api.spec.ts (A9): POST /payment/check with the same Payment objects as S2. */
@ToolshopTest
@DisplayName("Payment check API")
class PaymentApiTest {

  @SmokeTest
  @DisplayName("A9: accepts every payment method with valid details")
  void acceptsValidDetails(Playwright playwright) {
    try (ApiClient api = ApiClient.create(playwright)) {
      assertAll(Payments.allMethods().stream().map(p -> () -> assertDoesNotThrow(() -> api.checkPayment(p), p.method())));
    }
  }

  @SmokeTest
  @Negative
  @DisplayName("A9: rejects an invalid card, naming only the broken field")
  void rejectsInvalidCard(Playwright playwright) {
    try (ApiClient api = ApiClient.create(playwright)) {
      assertAll(Payments.invalidCards().stream().map(card -> () -> {
        APIResponse res = api.paymentCheckRequest(card.payment());
        assertEquals(422, res.status(), card.name());
        assertEquals(List.of("payment_details." + card.field()), api.paymentRejectedFields(res), card.name());
      }));
    }
  }
}
