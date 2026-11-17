package com.showcase.data;

import java.time.Year;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Java twin of src/data/payments.ts: payment data in the API's own shape (method + details).
 * The checkout form's data-test ids equal the API field names, so one object fills the form and calls the API.
 */
public final class Payments {
  /** {@code details}: data-test id / API field → value; monthly_installments is a select, the rest text fields. */
  public record Payment(String method, Map<String, String> details) {}

  /** An invalid card breaking one rule; {@code field} is the input the UI must flag. */
  public record InvalidCard(String name, Payment payment, String field) {}

  private Payments() {}

  /** December of next year, as MM/YYYY: a card expiry that never goes stale. */
  private static String nextYearExpiry() {
    return "12/" + Year.now().plusYears(1);
  }

  public static Payment cashOnDelivery() {
    return new Payment("cash-on-delivery", Map.of());
  }

  public static Payment bankTransfer() {
    return new Payment("bank-transfer", Map.of("bank_name", "Test Bank", "account_name", "Test Buyer", "account_number", "12345678"));
  }

  public static Payment creditCard() {
    return creditCard(Map.of());
  }

  public static Payment creditCard(Map<String, String> overrides) {
    Map<String, String> details = new HashMap<>(Map.of(
        "credit_card_number", "4111-1111-1111-1111",
        "expiration_date", nextYearExpiry(),
        "cvv", "123",
        "card_holder_name", "Test Buyer"));
    details.putAll(overrides);
    return new Payment("credit-card", Map.copyOf(details));
  }

  public static Payment buyNowPayLater() {
    return new Payment("buy-now-pay-later", Map.of("monthly_installments", "6"));
  }

  public static Payment giftCard() {
    return new Payment("gift-card", Map.of("gift_card_number", "ABCD1234EFGH5678", "validation_code", "AB12"));
  }

  /** The S2 journeys: every method except cash on delivery, which is U6/S1 itself. */
  public static List<Payment> journeyMethods() {
    return List.of(bankTransfer(), creditCard(), buyNowPayLater(), giftCard());
  }

  public static List<Payment> allMethods() {
    return List.of(cashOnDelivery(), bankTransfer(), creditCard(), buyNowPayLater(), giftCard());
  }

  public static List<InvalidCard> invalidCards() {
    return List.of(
        new InvalidCard("malformed card number", creditCard(Map.of("credit_card_number", "1234")), "credit_card_number"),
        new InvalidCard("expired card", creditCard(Map.of("expiration_date", "01/2020")), "expiration_date"));
  }
}
