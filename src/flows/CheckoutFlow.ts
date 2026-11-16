import { expect, test } from '@playwright/test';
import type { Address, NewCustomer, Product } from '../api/ApiClient';
import type { CheckoutPage, PaymentMethod } from '../pages/CheckoutPage';
import type { Header } from '../pages/components/Header';
import type { ProductPage } from '../pages/ProductPage';

/**
 * The checkout journey as business steps, so long scenarios read like the story they test:
 *
 *   await checkout.addToCart(product);
 *   const total = await checkout.reviewCart([product]);
 *   await checkout.signIn(customer);
 *   await checkout.confirmAddress(customer.address);
 *   const invoice = await checkout.pay('cash-on-delivery');
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
      await this.checkoutPage.proceedFromCart.click();
      return total;
    });
  }

  async signIn(customer: Pick<NewCustomer, 'email' | 'password'>): Promise<void> {
    await test.step('sign in', async () => {
      await this.checkoutPage.signIn(customer.email, customer.password);
      await expect(this.checkoutPage.proceedFromSignIn).toBeEnabled();
      await this.checkoutPage.proceedFromSignIn.click();
    });
  }

  /** Enters country, postcode and house number; the app's postcode lookup must fill in the rest. */
  async confirmAddress(address: Address): Promise<void> {
    await test.step('billing address via postcode lookup', async () => {
      await this.checkoutPage.enterAddressForLookup(address);
      await expect(this.checkoutPage.street).toHaveValue(address.street);
      await expect(this.checkoutPage.city).toHaveValue(address.city);
      await expect(this.checkoutPage.state).toHaveValue(address.state);
      await expect(this.checkoutPage.proceedFromAddress).toBeEnabled();
      await this.checkoutPage.proceedFromAddress.click();
    });
  }

  /** Pays with the given method and places the order; returns the invoice number from the confirmation. */
  async pay(method: PaymentMethod): Promise<string> {
    return test.step(`pay with ${method}`, async () => {
      await this.checkoutPage.paymentMethod.selectOption(method);
      await this.checkoutPage.finish.click(); // 1st click: payment check
      await expect(this.checkoutPage.paymentSuccess).toBeVisible();
      await this.checkoutPage.placeOrder(); // 2nd click: creates the invoice, waits for the API
      await expect(this.checkoutPage.orderConfirmation).toContainText(/INV-\d+/);
      return (await this.checkoutPage.orderConfirmation.textContent())?.match(/INV-\d+/)?.[0] ?? '';
    });
  }
}
