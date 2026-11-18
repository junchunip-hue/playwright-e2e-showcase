package com.showcase.pages;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.PlaywrightException;
import com.microsoft.playwright.Response;
import com.microsoft.playwright.assertions.LocatorAssertions;
import java.net.URI;
import com.microsoft.playwright.options.AriaRole;
import java.util.Map;
import java.util.regex.Pattern;
import org.opentest4j.AssertionFailedError;

/** Java twin of src/pages/CheckoutPage.ts: the 4-step wizard (cart, sign in, billing address, payment). */
public class CheckoutPage {
  /** POST /invoices, or POST /invoices/guest for a guest (S4). */
  private static final Pattern INVOICE_POST = Pattern.compile("/invoices(/guest)?$");
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

  public CheckoutPage(Page page) {
    this.page = page;
    this.productTitles = page.getByTestId("product-title");
    this.cartTotal = page.getByTestId("cart-total");
    this.proceedFromCart = page.getByTestId("proceed-1");

    this.email = page.getByTestId("email");
    this.password = page.getByTestId("password");
    this.loginSubmit = page.getByTestId("login-submit");
    this.proceedFromSignIn = page.getByTestId("proceed-2");

    this.guestTab = page.getByRole(AriaRole.TAB, new Page.GetByRoleOptions().setName(Pattern.compile("guest", Pattern.CASE_INSENSITIVE)));
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

  public void navigate() {
    page.navigate("/checkout");
  }

  /** A payment detail field; its data-test id is also the API field name (see data.Payments). */
  public Locator paymentField(String name) {
    return page.getByTestId(name);
  }

  /**
   * Second click on Finish: the app creates the invoice (POST /invoices, or /invoices/guest for a guest) and only then
   * shows the confirmation.
   * Waits for that response, so a slow backend is waited for and a failing one is reported as the API error.
   */
  public void placeOrder() {
    Response response = page.waitForResponse(
        res -> "POST".equals(res.request().method()) && INVOICE_POST.matcher(URI.create(res.url()).getPath()).find(),
        finish::click);
    if (!response.ok()) {
      String path = URI.create(response.url()).getPath();
      throw new IllegalStateException("POST " + path + " failed: " + response.status() + "\n" + response.text());
    }
  }

  /**
   * Enters country + postcode + house number and waits for the app's postcode lookup, which fills street, city and
   * state. Without the wait, the fields already hold the customer's saved address (GET /users/me), so the checks
   * would pass before the lookup ran, and its late result would rewrite the form while "proceed" is clicked.
   */
  public void enterAddressForLookup(Map<String, String> address) {
    Response response = page.waitForResponse(
        res -> URI.create(res.url()).getPath().endsWith("/postcode-lookup"),
        () -> {
          country.selectOption(address.get("country"));
          postalCode.fill(address.get("postal_code"));
          houseNumber.fill(address.get("house_number"));
        });
    if (!response.ok()) {
      throw new IllegalStateException("GET /postcode-lookup failed: " + response.status() + ": " + response.text());
    }
    assertThat(postcodeLookupError).isHidden();
  }

  /**
   * Clicks a wizard "proceed" button until the next step shows (twin of CheckoutPage.proceed in TypeScript). The
   * address form is rewritten by async results, and a click that lands while it updates can leave the wizard on the
   * same step. The step change is asserted, and the click is repeated only while the button is still on screen.
   */
  public void proceed(Locator button, Locator nextStep) {
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
