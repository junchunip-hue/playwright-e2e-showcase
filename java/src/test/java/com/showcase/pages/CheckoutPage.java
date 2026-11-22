package com.showcase.pages;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.PlaywrightException;
import com.microsoft.playwright.Response;
import com.microsoft.playwright.assertions.LocatorAssertions;
import com.showcase.api.ApiClient.Payment;
import com.showcase.modules.CheckoutModule;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.opentest4j.AssertionFailedError;

/**
 * Page layer: what a customer does in the 4-step checkout wizard, with the waits that make each
 * step safe to continue from (a wizard step counts as done only when the next one shows). Steps
 * call these methods in the order a feature tells; assertions on the outcome stay in the steps.
 * TypeScript twin: src/pages/checkout.page.ts.
 */
public class CheckoutPage {
  private static final Pattern INVOICE_POST = Pattern.compile("/invoices(/guest)?$");
  private static final Pattern INVOICE_NUMBER = Pattern.compile("INV-\\d+");
  private final Page page;

  /** The locators, for the steps' assertions. */
  public final CheckoutModule ui;

  public CheckoutPage(Page page) {
    this.page = page;
    this.ui = new CheckoutModule(page);
  }

  public void open() {
    page.navigate("/checkout");
  }

  /**
   * Opens the cart, checks it holds exactly these products and returns the total shown (discounts
   * applied).
   */
  public double reviewCart(List<String> productNames) {
    open();
    assertThat(ui.productTitles).hasText(productNames.toArray(String[]::new));
    double total = Double.parseDouble(ui.cartTotal.textContent().replaceAll("[^0-9.]", ""));
    // Step 2 shows the sign-in form, or only "proceed" for a customer who is already signed in
    // (S5).
    proceed(ui.proceedFromCart, ui.signIn.email.or(ui.proceedFromSignIn));
    return total;
  }

  /** Step 2 for a customer who is not signed in yet. */
  public void signIn(String email, String password) {
    ui.signIn.email.fill(email);
    ui.signIn.password.fill(password);
    ui.signIn.submit.click();
    assertThat(ui.proceedFromSignIn).isEnabled();
    proceed(ui.proceedFromSignIn, ui.country);
  }

  /**
   * Step 2 for a customer who signed in before shopping (S5): it only confirms who is signed in.
   */
  public void continueSignedIn() {
    assertThat(ui.proceedFromSignIn).isEnabled();
    proceed(ui.proceedFromSignIn, ui.country);
  }

  /** Step 2 without an account: the guest tab takes email and name. */
  public void continueAsGuest(String email, String firstName, String lastName) {
    ui.guestTab.click();
    ui.guestEmail.fill(email);
    ui.guestFirstName.fill(firstName);
    ui.guestLastName.fill(lastName);
    ui.guestSubmit.click();
    assertThat(ui.proceedAsGuest).isEnabled();
    proceed(ui.proceedAsGuest, ui.country);
  }

  /**
   * Step 3 for a guest (empty form): enters country, postcode and house number, waits for the app's
   * postcode lookup (it fills street, city and state), then confirms the address. Not for a
   * signed-in customer: the app fills that form with the saved address at a moment of its own, and
   * typing at the same time corrupts the field.
   */
  public void enterAddressForLookup(Map<String, String> address) {
    Response response =
        page.waitForResponse(
            res -> URI.create(res.url()).getPath().endsWith("/postcode-lookup"),
            () -> {
              ui.country.selectOption(address.get("country"));
              ui.postalCode.fill(address.get("postal_code"));
              ui.houseNumber.fill(address.get("house_number"));
            });
    if (!response.ok()) {
      throw new IllegalStateException(
          "GET /postcode-lookup failed: " + response.status() + ": " + response.text());
    }
    assertThat(ui.postcodeLookupError).isHidden();
    confirmAddress(address);
  }

  /**
   * Step 3 for a signed-in customer: the app fills in and looks up the saved address by itself, at
   * a moment that differs per browser, so nothing is typed (typing raced that fill-in: the postcode
   * became "9021090210", TS on Firefox, nightly 2026-11-19). Waiting for the fields to show the
   * saved, looked-up address is enough; proceed repeats the click if the lookup rewrites the form
   * at that moment.
   */
  public void confirmAddress(Map<String, String> address) {
    // The country is checked too: the order is rejected (422) when it does not match the postcode.
    assertThat(ui.country).hasValue(address.get("country"));
    assertThat(ui.postalCode).hasValue(address.get("postal_code"));
    assertThat(ui.street).hasValue(address.get("street"));
    assertThat(ui.city).hasValue(address.get("city"));
    assertThat(ui.state).hasValue(address.get("state"));
    assertThat(ui.proceedFromAddress).isEnabled();
    proceed(ui.proceedFromAddress, ui.paymentMethod);
  }

  /** Step 4: selects the payment method and fills its details, without submitting. */
  public void enterPayment(Payment payment) {
    ui.paymentMethod.selectOption(payment.method());
    payment
        .details()
        .forEach((field, value) -> {
          if ("monthly_installments".equals(field)) ui.paymentField(field).selectOption(value);
          else ui.paymentField(field).fill(value);
        });
  }

  /** Step 4: pays and places the order; returns the invoice number from the confirmation. */
  public String pay(Payment payment) {
    enterPayment(payment);
    ui.finish.click(); // 1st click: payment check
    assertThat(ui.paymentSuccess).isVisible();
    placeOrder(); // 2nd click: creates the invoice, waits for the API
    assertThat(ui.orderConfirmation).containsText(INVOICE_NUMBER);
    Matcher m = INVOICE_NUMBER.matcher(ui.orderConfirmation.textContent());
    return m.find() ? m.group() : "";
  }

  /**
   * Second click on Finish: the app creates the invoice (POST /invoices, or /invoices/guest for a
   * guest) and only then shows the confirmation. Waiting for that response means a slow backend is
   * waited for, and a failing one is reported as the API error.
   */
  private void placeOrder() {
    Response response =
        page.waitForResponse(
            res ->
                "POST".equals(res.request().method())
                    && INVOICE_POST.matcher(URI.create(res.url()).getPath()).find(),
            ui.finish::click);
    if (!response.ok()) {
      String path = URI.create(response.url()).getPath();
      throw new IllegalStateException(
          "POST " + path + " failed: " + response.status() + "\n" + response.text());
    }
  }

  /**
   * Clicks a wizard "proceed" button until the next step shows (TS: toPass). The address form is
   * rewritten by async results, and a click that lands while it updates can leave the wizard on the
   * same step; the step change is the real "done", so it is asserted, and the click is repeated
   * only while the button is still on screen.
   */
  private void proceed(Locator button, Locator nextStep) {
    long deadline = System.currentTimeMillis() + 15_000;
    while (true) {
      try {
        if (button.isVisible()) button.click(new Locator.ClickOptions().setTimeout(2_000));
        assertThat(nextStep).isVisible(new LocatorAssertions.IsVisibleOptions().setTimeout(2_000));
        return;
      } catch (AssertionFailedError | PlaywrightException e) {
        if (System.currentTimeMillis() > deadline) {
          throw new AssertionError("the wizard did not move on after clicking " + button, e);
        }
      }
    }
  }
}
