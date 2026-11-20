package com.showcase.modules;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;
import java.util.regex.Pattern;

/**
 * Module layer: locators of the 4-step checkout wizard (cart → sign in → billing address →
 * payment). TypeScript twin: src/modules/checkout.module.ts.
 */
public class CheckoutModule {
  private final Page page;
  // Step 1: cart
  public final Locator productTitles;
  public final Locator cartTotal;
  public final Locator proceedFromCart;
  // Step 2: sign in (the same form as on the login page)
  public final LoginModule signIn;
  public final Locator proceedFromSignIn;
  // Step 2, guest tab: checkout without an account (S4)
  public final Locator guestTab;
  public final Locator guestEmail;
  public final Locator guestFirstName;
  public final Locator guestLastName;
  public final Locator guestSubmit;
  public final Locator proceedAsGuest;
  // Step 3: billing address
  public final Locator country;
  public final Locator postalCode;
  public final Locator houseNumber;
  public final Locator street;
  public final Locator city;
  public final Locator state;
  public final Locator proceedFromAddress;
  public final Locator postcodeLookupError;
  // Step 4: payment
  public final Locator paymentMethod;
  public final Locator finish;
  public final Locator paymentSuccess;

  /** Inline field errors of the payment form (Bootstrap alerts, no data-test). */
  public final Locator paymentFieldErrors;

  public final Locator orderConfirmation;

  public CheckoutModule(Page page) {
    this.page = page;
    this.productTitles = page.getByTestId("product-title");
    this.cartTotal = page.getByTestId("cart-total");
    this.proceedFromCart = page.getByTestId("proceed-1");

    this.signIn = new LoginModule(page);
    this.proceedFromSignIn = page.getByTestId("proceed-2");

    // Bootstrap tab link, no data-test
    this.guestTab =
        page.getByRole(
            AriaRole.TAB,
            new Page.GetByRoleOptions()
                .setName(Pattern.compile("guest", Pattern.CASE_INSENSITIVE)));
    this.guestEmail = page.getByTestId("guest-email");
    this.guestFirstName = page.getByTestId("guest-first-name");
    this.guestLastName = page.getByTestId("guest-last-name");
    this.guestSubmit = page.getByTestId("guest-submit");
    this.proceedAsGuest = page.getByTestId("proceed-2-guest");

    this.country = page.getByTestId("country");
    this.postalCode = page.getByTestId("postal_code");
    this.houseNumber = page.getByTestId("house_number");
    this.street = page.getByTestId("street");
    this.city = page.getByTestId("city");
    this.state = page.getByTestId("state");
    this.proceedFromAddress = page.getByTestId("proceed-3");
    this.postcodeLookupError = page.getByTestId("postcode-lookup-error");

    this.paymentMethod = page.getByTestId("payment-method");
    this.finish = page.getByTestId("finish");
    this.paymentSuccess = page.getByTestId("payment-success-message");
    this.paymentFieldErrors = page.locator(".alert-danger");
    this.orderConfirmation = page.locator("#order-confirmation"); // no data-test on this element
  }

  /** A payment detail field; its data-test id is also the API field name (see data/Payments). */
  public Locator paymentField(String name) {
    return page.getByTestId(name);
  }
}
