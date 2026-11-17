package com.showcase.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Response;

/** Java twin of src/pages/CheckoutPage.ts: the 4-step wizard (cart, sign in, billing address, payment). */
public class CheckoutPage {
  private final Page page;
  // Step 1: cart
  public final Locator productTitles;
  public final Locator cartTotal;
  public final Locator proceedFromCart;
  // Step 2: sign in (same form as the login page)
  public final Locator email;
  public final Locator password;
  public final Locator loginSubmit;
  public final Locator proceedFromSignIn;
  // Step 3: billing address
  public final Locator country;
  public final Locator postalCode;
  public final Locator houseNumber;
  public final Locator street;
  public final Locator city;
  public final Locator state;
  public final Locator proceedFromAddress;
  // Step 4: payment
  public final Locator paymentMethod;
  public final Locator finish;
  public final Locator paymentSuccess;
  /** Inline field errors of the payment form (Bootstrap alerts, no data-test). */
  public final Locator paymentFieldErrors;
  public final Locator orderConfirmation;

  public CheckoutPage(Page page) {
    this.page = page;
    this.productTitles = page.getByTestId("product-title");
    this.cartTotal = page.getByTestId("cart-total");
    this.proceedFromCart = page.getByTestId("proceed-1");

    this.email = page.getByTestId("email");
    this.password = page.getByTestId("password");
    this.loginSubmit = page.getByTestId("login-submit");
    this.proceedFromSignIn = page.getByTestId("proceed-2");

    this.country = page.getByTestId("country");
    this.postalCode = page.getByTestId("postal_code");
    this.houseNumber = page.getByTestId("house_number");
    this.street = page.getByTestId("street");
    this.city = page.getByTestId("city");
    this.state = page.getByTestId("state");
    this.proceedFromAddress = page.getByTestId("proceed-3");

    this.paymentMethod = page.getByTestId("payment-method");
    this.finish = page.getByTestId("finish");
    this.paymentSuccess = page.getByTestId("payment-success-message");
    this.paymentFieldErrors = page.locator(".alert-danger");
    this.orderConfirmation = page.locator("#order-confirmation"); // no data-test on this element
  }

  public void navigate() {
    page.navigate("/checkout");
  }

  /** A payment detail field; its data-test id is also the API field name (see data.Payments). */
  public Locator paymentField(String name) {
    return page.getByTestId(name);
  }

  /**
   * Second click on Finish: the app creates the invoice (POST /invoices) and only then shows the confirmation.
   * Waits for that response, so a slow backend is waited for and a failing one is reported as the API error.
   */
  public void placeOrder() {
    Response response = page.waitForResponse(
        res -> "POST".equals(res.request().method()) && res.url().replaceAll("\\?.*$", "").endsWith("/invoices"),
        finish::click);
    if (!response.ok()) {
      throw new IllegalStateException("POST /invoices failed: " + response.status() + "\n" + response.text());
    }
  }
}
