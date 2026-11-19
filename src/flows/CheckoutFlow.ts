import { expect, test } from '@playwright/test';
import type { Address, NewCustomer, Product } from '../api/ApiClient';
import type { Payment } from '../data/payments';
import type { CheckoutPage } from '../pages/CheckoutPage';
import type { Header } from '../pages/components/Header';
import type { ProductPage } from '../pages/ProductPage';

/**
 * The checkout journey as business steps, so long scenarios read like the story they test:
 *
 *   await checkout.addToCart(product);
 *   const total = await checkout.reviewCart([product]);
 *   await checkout.signIn(customer);
 *   await checkout.confirmAddress(customer.address);
 *   const invoice = await checkout.pay(payments.cashOnDelivery());
 *
 * Page objects stay locator-only; flows add the order of actions and the waits that make each step safe to
 * continue from (e.g. "proceed" is enabled). Business assertions stay in the test. Each step is a test.step,
 * so the HTML report shows the journey with the same names.
 */
export class CheckoutFlow {
  constructor(
    private readonly productPage: ProductPage,
    private readonly header: Header,
    private readonly checkoutPage: CheckoutPage,
  ) {}

  /** Adds the product from its detail page; `cartCount` is the badge value expected afterwards. */
  async addToCart(product: Product, cartCount = 1): Promise<void> {
    await test.step(`add "${product.name}" to the cart`, async () => {
      await this.productPage.goto(product.id);
      await this.productPage.addToCart.click();
      await expect(this.header.cartQuantity).toHaveText(String(cartCount));
    });
  }

  /** Opens the cart, checks it holds exactly these products and returns the total shown (discounts applied). */
  async reviewCart(products: Product[]): Promise<number> {
    return test.step('review the cart', async () => {
      await this.checkoutPage.goto();
      await expect(this.checkoutPage.productTitles).toHaveText(products.map((p) => p.name));
      const total = Number((await this.checkoutPage.cartTotal.textContent())?.replace(/[^0-9.]/g, ''));
      // Step 2 shows the sign-in form, or only "proceed" for a customer who is already signed in (S5).
      const stepTwo = this.checkoutPage.signInForm.email.or(this.checkoutPage.proceedFromSignIn);
      await this.checkoutPage.proceed(this.checkoutPage.proceedFromCart, stepTwo);
      return total;
    });
  }

  async signIn(customer: Pick<NewCustomer, 'email' | 'password'>): Promise<void> {
    await test.step('sign in', async () => {
      await this.checkoutPage.signIn(customer.email, customer.password);
      await expect(this.checkoutPage.proceedFromSignIn).toBeEnabled();
      await this.checkoutPage.proceed(this.checkoutPage.proceedFromSignIn, this.checkoutPage.country);
    });
  }

  /** For a customer who signed in before shopping (S5): step 2 only confirms who is signed in. */
  async continueSignedIn(): Promise<void> {
    await test.step('continue as the signed-in customer', async () => {
      await expect(this.checkoutPage.proceedFromSignIn).toBeEnabled();
      // Opening the address step fills in the saved address and looks it up at once. Waiting for that lookup here
      // (it starts before the click) leaves a settled form for confirmSavedAddress; typing the same values again
      // would trigger no new lookup to wait for (nightly 2026-11-19, Java).
      const lookup = this.checkoutPage.postcodeLookup();
      await this.checkoutPage.proceed(this.checkoutPage.proceedFromSignIn, this.checkoutPage.country);
      await lookup;
    });
  }

  /** Checks out without an account: the guest tab takes email and name, then the wizard moves on to the address. */
  async continueAsGuest(guest: Pick<NewCustomer, 'email' | 'first_name' | 'last_name'>): Promise<void> {
    await test.step('continue as guest', async () => {
      await this.checkoutPage.guestTab.click();
      await this.checkoutPage.guestEmail.fill(guest.email);
      await this.checkoutPage.guestFirstName.fill(guest.first_name);
      await this.checkoutPage.guestLastName.fill(guest.last_name);
      await this.checkoutPage.guestSubmit.click();
      await expect(this.checkoutPage.proceedAsGuest).toBeEnabled();
      await this.checkoutPage.proceed(this.checkoutPage.proceedAsGuest, this.checkoutPage.country);
    });
  }

  /** Enters country, postcode and house number; the app's postcode lookup must fill in the rest (waited for). */
  async confirmAddress(address: Address): Promise<void> {
    await test.step('billing address via postcode lookup', async () => {
      await this.checkoutPage.enterAddressForLookup(address);
      await this.checkAddressAndProceed(address);
    });
  }

  /** After continueSignedIn: the saved address is already filled in and looked up; check it and move on. */
  async confirmSavedAddress(address: Address): Promise<void> {
    await test.step('saved billing address', async () => {
      await this.checkAddressAndProceed(address);
    });
  }

  private async checkAddressAndProceed(address: Address): Promise<void> {
    // The country is checked too: the order is rejected (422) when it does not match the postcode.
    await expect(this.checkoutPage.country).toHaveValue(address.country);
    await expect(this.checkoutPage.street).toHaveValue(address.street);
    await expect(this.checkoutPage.city).toHaveValue(address.city);
    await expect(this.checkoutPage.state).toHaveValue(address.state);
    await expect(this.checkoutPage.proceedFromAddress).toBeEnabled();
    await this.checkoutPage.proceed(this.checkoutPage.proceedFromAddress, this.checkoutPage.paymentMethod);
  }

  /** Selects the payment method and fills its details, without submitting. */
  async enterPayment(payment: Payment): Promise<void> {
    await test.step(`enter ${payment.method} details`, async () => {
      await this.checkoutPage.paymentMethod.selectOption(payment.method);
      for (const [field, value] of Object.entries(payment.details)) {
        const input = this.checkoutPage.paymentField(field);
        if (field === 'monthly_installments') await input.selectOption(value);
        else await input.fill(value);
      }
    });
  }

  /** Pays and places the order; returns the invoice number from the confirmation. */
  async pay(payment: Payment): Promise<string> {
    await this.enterPayment(payment);
    return test.step(`pay with ${payment.method}`, async () => {
      await this.checkoutPage.finish.click(); // 1st click: payment check
      await expect(this.checkoutPage.paymentSuccess).toBeVisible();
      await this.checkoutPage.placeOrder(); // 2nd click: creates the invoice, waits for the API
      await expect(this.checkoutPage.orderConfirmation).toContainText(/INV-\d+/);
      return (await this.checkoutPage.orderConfirmation.textContent())?.match(/INV-\d+/)?.[0] ?? '';
    });
  }
}
