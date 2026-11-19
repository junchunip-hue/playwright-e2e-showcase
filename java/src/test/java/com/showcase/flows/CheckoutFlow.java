package com.showcase.flows;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.microsoft.playwright.Page;
import com.showcase.api.ApiClient.Product;
import com.showcase.data.Customers.Customer;
import com.showcase.data.Payments.Payment;
import com.showcase.pages.CheckoutPage;
import com.showcase.pages.Header;
import com.showcase.pages.ProductPage;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Java twin of src/flows/CheckoutFlow.ts: the checkout journey as business steps, method for method.
 *
 * <pre>
 *   checkout.addToCart(product);
 *   double total = checkout.reviewCart(List.of(product));
 *   checkout.signIn(customer);
 *   checkout.confirmAddress(customer.address());
 *   String invoice = checkout.pay(Payments.cashOnDelivery());
 * </pre>
 *
 * Page objects stay locator-only; flows add the order of actions and the waits that make each step safe to continue
 * from. Business assertions stay in the test.
 */
public class CheckoutFlow {
  private static final Pattern INVOICE_NUMBER = Pattern.compile("INV-\\d+");

  private final ProductPage productPage;
  private final Header header;
  private final CheckoutPage checkoutPage;

  public CheckoutFlow(Page page) {
    this.productPage = new ProductPage(page);
    this.header = new Header(page);
    this.checkoutPage = new CheckoutPage(page);
  }

  public CheckoutPage page() {
    return checkoutPage;
  }

  /** Adds the product from its detail page; the cart badge must then show {@code cartCount}. */
  public void addToCart(Product product, int cartCount) {
    productPage.navigate(product.id());
    productPage.addToCart.click();
    assertThat(header.cartQuantity).hasText(String.valueOf(cartCount));
  }

  public void addToCart(Product product) {
    addToCart(product, 1);
  }

  /** Opens the cart, checks it holds exactly these products and returns the total shown (discounts applied). */
  public double reviewCart(List<Product> products) {
    checkoutPage.navigate();
    assertThat(checkoutPage.productTitles).hasText(products.stream().map(Product::name).toArray(String[]::new));
    double total = Double.parseDouble(checkoutPage.cartTotal.textContent().replaceAll("[^0-9.]", ""));
    // Step 2 shows the sign-in form, or only "proceed" for a customer who is already signed in (S5).
    checkoutPage.proceed(checkoutPage.proceedFromCart, checkoutPage.email.or(checkoutPage.proceedFromSignIn));
    return total;
  }

  public void signIn(Customer customer) {
    checkoutPage.email.fill(customer.email());
    checkoutPage.password.fill(customer.password());
    checkoutPage.loginSubmit.click();
    assertThat(checkoutPage.proceedFromSignIn).isEnabled();
    checkoutPage.proceed(checkoutPage.proceedFromSignIn, checkoutPage.country);
  }

  /** For a customer who signed in before shopping (S5): step 2 only confirms who is signed in. */
  public void continueSignedIn() {
    assertThat(checkoutPage.proceedFromSignIn).isEnabled();
    // Opening the address step fills in the saved address and looks it up at once; wait for that lookup here, so
    // confirmSavedAddress finds a settled form (typing the same values again would trigger no new lookup).
    checkoutPage.whilePostcodeLookup(() -> checkoutPage.proceed(checkoutPage.proceedFromSignIn, checkoutPage.country));
  }

  /** Checks out without an account (TS: continueAsGuest): guest tab, email and name, then on to the address. */
  public void continueAsGuest(String email, String firstName, String lastName) {
    checkoutPage.guestTab.click();
    checkoutPage.guestEmail.fill(email);
    checkoutPage.guestFirstName.fill(firstName);
    checkoutPage.guestLastName.fill(lastName);
    checkoutPage.guestSubmit.click();
    assertThat(checkoutPage.proceedAsGuest).isEnabled();
    checkoutPage.proceed(checkoutPage.proceedAsGuest, checkoutPage.country);
  }

  /** Enters country, postcode and house number; the app's postcode lookup must fill in the rest (waited for). */
  public void confirmAddress(Map<String, String> address) {
    checkoutPage.enterAddressForLookup(address);
    checkAddressAndProceed(address);
  }

  /** After continueSignedIn: the saved address is already filled in and looked up; check it and move on. */
  public void confirmSavedAddress(Map<String, String> address) {
    checkAddressAndProceed(address);
  }

  private void checkAddressAndProceed(Map<String, String> address) {
    // The country is checked too: the order is rejected (422) when it does not match the postcode.
    assertThat(checkoutPage.country).hasValue(address.get("country"));
    assertThat(checkoutPage.street).hasValue(address.get("street"));
    assertThat(checkoutPage.city).hasValue(address.get("city"));
    assertThat(checkoutPage.state).hasValue(address.get("state"));
    assertThat(checkoutPage.proceedFromAddress).isEnabled();
    checkoutPage.proceed(checkoutPage.proceedFromAddress, checkoutPage.paymentMethod);
  }

  /** Selects the payment method and fills its details, without submitting. */
  public void enterPayment(Payment payment) {
    checkoutPage.paymentMethod.selectOption(payment.method());
    payment.details().forEach((field, value) -> {
      if ("monthly_installments".equals(field)) checkoutPage.paymentField(field).selectOption(value);
      else checkoutPage.paymentField(field).fill(value);
    });
  }

  /** Pays and places the order; returns the invoice number from the confirmation. */
  public String pay(Payment payment) {
    enterPayment(payment);
    checkoutPage.finish.click(); // 1st click: payment check
    assertThat(checkoutPage.paymentSuccess).isVisible();
    checkoutPage.placeOrder(); // 2nd click: creates the invoice, waits for the API
    assertThat(checkoutPage.orderConfirmation).containsText(INVOICE_NUMBER);
    Matcher m = INVOICE_NUMBER.matcher(checkoutPage.orderConfirmation.textContent());
    return m.find() ? m.group() : "";
  }
}
