import { expect, type Locator, type Page } from '@playwright/test';

import type { Address, NewCustomer, Payment } from '../api/ApiClient';
import { CheckoutModule } from '../modules/checkout.module';

/**
 * Page layer: what a customer does in the 4-step checkout wizard, with the waits that make each step safe to
 * continue from (a wizard step counts as done only when the next one shows). Steps call these methods in the order
 * a feature tells; assertions on the outcome stay in the steps. Java twin: pages/CheckoutPage.java.
 */
export class CheckoutPage {
  /** The locators, for the steps' assertions. */
  readonly ui: CheckoutModule;

  constructor(private readonly page: Page) {
    this.ui = new CheckoutModule(page);
  }

  async open(): Promise<void> {
    await this.page.goto('/checkout');
  }

  /** Opens the cart, checks it holds exactly these products and returns the total shown (discounts applied). */
  async reviewCart(productNames: string[]): Promise<number> {
    await this.open();
    await expect(this.ui.productTitles).toHaveText(productNames);
    const total = Number((await this.ui.cartTotal.textContent())?.replace(/[^0-9.]/g, ''));
    // Step 2 shows the sign-in form, or only "proceed" for a customer who is already signed in (S5).
    await this.proceed(this.ui.proceedFromCart, this.ui.signIn.email.or(this.ui.proceedFromSignIn));
    return total;
  }

  /** Step 2 for a customer who is not signed in yet. */
  async signIn(email: string, password: string): Promise<void> {
    await this.ui.signIn.email.fill(email);
    await this.ui.signIn.password.fill(password);
    await this.ui.signIn.submit.click();
    await expect(this.ui.proceedFromSignIn).toBeEnabled();
    await this.proceed(this.ui.proceedFromSignIn, this.ui.country);
  }

  /** Step 2 for a customer who signed in before shopping (S5): it only confirms who is signed in. */
  async continueSignedIn(): Promise<void> {
    await expect(this.ui.proceedFromSignIn).toBeEnabled();
    await this.proceed(this.ui.proceedFromSignIn, this.ui.country);
  }

  /** Step 2 without an account: the guest tab takes email and name. */
  async continueAsGuest(guest: Pick<NewCustomer, 'email' | 'first_name' | 'last_name'>): Promise<void> {
    await this.ui.guestTab.click();
    await this.ui.guestEmail.fill(guest.email);
    await this.ui.guestFirstName.fill(guest.first_name);
    await this.ui.guestLastName.fill(guest.last_name);
    await this.ui.guestSubmit.click();
    await expect(this.ui.proceedAsGuest).toBeEnabled();
    await this.proceed(this.ui.proceedAsGuest, this.ui.country);
  }

  /**
   * Step 3 for a guest (empty form): enters country, postcode and house number, waits for the app's postcode
   * lookup (it fills street, city and state), then confirms the address. Not for a signed-in customer: the app
   * fills that form with the saved address at a moment of its own, and typing at the same time corrupts the field.
   */
  async enterAddressForLookup(address: Address): Promise<void> {
    const lookup = this.postcodeLookup();
    await this.ui.country.selectOption(address.country);
    await this.ui.postalCode.fill(address.postal_code);
    await this.ui.houseNumber.fill(address.house_number);
    await lookup;
    await this.confirmAddress(address);
  }

  /**
   * Step 3 for a signed-in customer: the app fills in the saved address (GET /users/me) and looks it up by itself,
   * at a moment that differs per browser, so nothing is typed:
   *   - typing races that fill-in: `fill` selected the postcode, the saved "90210" landed, and the typed one was
   *     appended, so the app looked up "9021090210" and got a 422 (S2, Firefox, nightly 2026-11-19);
   *   - typing the same values again triggers no new lookup, so there is no request to wait for (S5).
   * The saved address is the looked-up one, so waiting for the fields to show it proves the fill-in and the lookup
   * happened; `proceed` repeats the click if the lookup rewrites the form at that moment.
   */
  async confirmAddress(address: Address): Promise<void> {
    // The country is checked too: the order is rejected (422) when it does not match the postcode.
    await expect(this.ui.country).toHaveValue(address.country);
    await expect(this.ui.postalCode).toHaveValue(address.postal_code);
    await expect(this.ui.street).toHaveValue(address.street);
    await expect(this.ui.city).toHaveValue(address.city);
    await expect(this.ui.state).toHaveValue(address.state);
    await expect(this.ui.proceedFromAddress).toBeEnabled();
    await this.proceed(this.ui.proceedFromAddress, this.ui.paymentMethod);
  }

  /** Step 4: selects the payment method and fills its details, without submitting. */
  async enterPayment(payment: Payment): Promise<void> {
    await this.ui.paymentMethod.selectOption(payment.method);
    for (const [field, value] of Object.entries(payment.details)) {
      const input = this.ui.paymentField(field);
      if (field === 'monthly_installments') await input.selectOption(value);
      else await input.fill(value);
    }
  }

  /** Step 4: pays and places the order; returns the invoice number from the confirmation. */
  async pay(payment: Payment): Promise<string> {
    await this.enterPayment(payment);
    await this.ui.finish.click(); // 1st click: payment check
    await expect(this.ui.paymentSuccess).toBeVisible();
    await this.placeOrder(); // 2nd click: creates the invoice, waits for the API
    await expect(this.ui.orderConfirmation).toContainText(/INV-\d+/);
    return (await this.ui.orderConfirmation.textContent())?.match(/INV-\d+/)?.[0] ?? '';
  }

  /**
   * Second click on Finish: the app creates the invoice (POST /invoices, or POST /invoices/guest for a guest) and only
   * then shows the confirmation. Waiting for that response means a slow backend is waited for, and a failing one is
   * reported as the API error.
   */
  private async placeOrder(): Promise<void> {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (res) => res.request().method() === 'POST' && /\/invoices(\/guest)?$/.test(new URL(res.url()).pathname),
      ),
      this.ui.finish.click(),
    ]);
    if (!response.ok()) {
      const path = new URL(response.url()).pathname;
      throw new Error(`POST ${path} failed: ${response.status()}\n${(await response.text()).slice(0, 500)}`);
    }
  }

  /** Resolves when the app's next postcode lookup has answered (and fails if it failed). */
  private async postcodeLookup(): Promise<void> {
    const response = await this.page.waitForResponse((res) => new URL(res.url()).pathname.endsWith('/postcode-lookup'));
    if (!response.ok()) throw new Error(`GET /postcode-lookup failed: ${response.status()}: ${await response.text()}`);
    await expect(this.ui.postcodeLookupError).toBeHidden();
  }

  /**
   * Clicks a wizard "proceed" button until the next step shows. The address form is rewritten by async results
   * (saved address, postcode lookups, each debounced), and a click that lands while the form updates can leave the
   * wizard on the same step (nightly 2026-11-18, WebKit). The step change is the real "done", so it is asserted, and
   * the click is repeated only while the button is still on screen.
   */
  private async proceed(button: Locator, nextStep: Locator): Promise<void> {
    await expect(async () => {
      if (await button.isVisible()) await button.click({ timeout: 2_000 });
      await expect(nextStep).toBeVisible({ timeout: 2_000 });
    }, `the wizard did not move on after clicking ${button}`).toPass({ timeout: 15_000 });
  }
}
