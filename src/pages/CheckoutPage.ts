import { expect, type Locator, type Page } from '@playwright/test';
import type { Address } from '../api/ApiClient';
import { LoginForm } from './components/LoginForm';

/** The 4-step checkout wizard: cart -> sign in -> billing address -> payment. */
export class CheckoutPage {
  // Step 1: cart
  readonly productTitles: Locator;
  readonly cartTotal: Locator;
  readonly proceedFromCart: Locator;
  // Step 2: sign in
  readonly signInForm: LoginForm;
  readonly proceedFromSignIn: Locator;
  // Step 2, guest tab: checkout without an account (S4)
  readonly guestTab: Locator;
  readonly guestEmail: Locator;
  readonly guestFirstName: Locator;
  readonly guestLastName: Locator;
  readonly guestSubmit: Locator;
  readonly proceedAsGuest: Locator;
  // Step 3: billing address
  readonly country: Locator;
  readonly postalCode: Locator;
  readonly houseNumber: Locator;
  readonly street: Locator;
  readonly city: Locator;
  readonly state: Locator;
  readonly proceedFromAddress: Locator;
  readonly postcodeLookupError: Locator;
  // Step 4: payment
  readonly paymentMethod: Locator;
  readonly finish: Locator;
  readonly paymentSuccess: Locator;
  /** Inline field errors of the payment form (Bootstrap alerts, no data-test). */
  readonly paymentFieldErrors: Locator;
  readonly orderConfirmation: Locator;

  constructor(private readonly page: Page) {
    this.productTitles = page.getByTestId('product-title');
    this.cartTotal = page.getByTestId('cart-total');
    this.proceedFromCart = page.getByTestId('proceed-1');

    this.signInForm = new LoginForm(page);
    this.proceedFromSignIn = page.getByTestId('proceed-2');

    this.guestTab = page.getByRole('tab', { name: /guest/i }); // Bootstrap tab link, no data-test
    this.guestEmail = page.getByTestId('guest-email');
    this.guestFirstName = page.getByTestId('guest-first-name');
    this.guestLastName = page.getByTestId('guest-last-name');
    this.guestSubmit = page.getByTestId('guest-submit');
    this.proceedAsGuest = page.getByTestId('proceed-2-guest');

    this.country = page.getByTestId('country');
    this.postalCode = page.getByTestId('postal_code');
    this.houseNumber = page.getByTestId('house_number');
    this.street = page.getByTestId('street');
    this.city = page.getByTestId('city');
    this.state = page.getByTestId('state');
    this.proceedFromAddress = page.getByTestId('proceed-3');
    this.postcodeLookupError = page.getByTestId('postcode-lookup-error');

    this.paymentMethod = page.getByTestId('payment-method');
    this.finish = page.getByTestId('finish');
    this.paymentSuccess = page.getByTestId('payment-success-message');
    this.paymentFieldErrors = page.locator('.alert-danger');
    this.orderConfirmation = page.locator('#order-confirmation'); // no data-test on this element
  }

  async goto(): Promise<void> {
    await this.page.goto('/checkout');
  }

  /** A payment detail field; its data-test id is also the API field name (see src/data/payments.ts). */
  paymentField(name: string): Locator {
    return this.page.getByTestId(name);
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.signInForm.signIn(email, password);
  }

  /**
   * Second click on Finish: the app creates the invoice (POST /invoices, or POST /invoices/guest for a guest) and only
   * then shows the confirmation.
   * Waiting for that response instead of a fixed assertion timeout means a slow backend (e.g. three browsers
   * checking out at once in the nightly run) is waited for, and a failing one is reported as the API error.
   */
  async placeOrder(): Promise<void> {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (res) => res.request().method() === 'POST' && /\/invoices(\/guest)?$/.test(new URL(res.url()).pathname),
      ),
      this.finish.click(),
    ]);
    if (!response.ok()) {
      const path = new URL(response.url()).pathname;
      throw new Error(`POST ${path} failed: ${response.status()}\n${(await response.text()).slice(0, 500)}`);
    }
  }

  /**
   * Enters country + postcode + house number and waits for the app's postcode lookup, which fills street, city and
   * state. Without the wait, the fields already hold the customer's saved address (GET /users/me), so the checks
   * would pass before the lookup ran, and its late result would rewrite the form while "proceed" is clicked.
   */
  async enterAddressForLookup(address: Address): Promise<void> {
    const lookup = this.page.waitForResponse((res) => new URL(res.url()).pathname.endsWith('/postcode-lookup'));
    await this.country.selectOption(address.country);
    await this.postalCode.fill(address.postal_code);
    await this.houseNumber.fill(address.house_number);
    const response = await lookup;
    if (!response.ok()) throw new Error(`GET /postcode-lookup failed: ${response.status()}: ${await response.text()}`);
    await expect(this.postcodeLookupError).toBeHidden();
  }

  /**
   * Clicks a wizard "proceed" button until the next step shows. The address form is rewritten by async results
   * (saved address, postcode lookups, each debounced), and a click that lands while the form updates can leave the
   * wizard on the same step (nightly 2026-11-18, WebKit). The step change is the real "done", so it is asserted,
   * and the click is repeated only while the button is still on screen; a step that never changes fails here, by
   * name, instead of as a timeout in the next step.
   */
  async proceed(button: Locator, nextStep: Locator): Promise<void> {
    await expect(async () => {
      if (await button.isVisible()) await button.click({ timeout: 2_000 });
      await expect(nextStep).toBeVisible({ timeout: 2_000 });
    }, `the wizard did not move on after clicking ${button}`).toPass({ timeout: 15_000 });
  }
}
