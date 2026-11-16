import type { Locator, Page } from '@playwright/test';
import type { Address } from '../api/ApiClient';
import { LoginForm } from './components/LoginForm';

export type PaymentMethod = 'bank-transfer' | 'cash-on-delivery' | 'credit-card' | 'buy-now-pay-later' | 'gift-card';

/** The 4-step checkout wizard: cart -> sign in -> billing address -> payment. */
export class CheckoutPage {
  // Step 1: cart
  readonly productTitles: Locator;
  readonly cartTotal: Locator;
  readonly proceedFromCart: Locator;
  // Step 2: sign in
  readonly signInForm: LoginForm;
  readonly proceedFromSignIn: Locator;
  // Step 3: billing address
  readonly country: Locator;
  readonly postalCode: Locator;
  readonly houseNumber: Locator;
  readonly street: Locator;
  readonly city: Locator;
  readonly state: Locator;
  readonly proceedFromAddress: Locator;
  // Step 4: payment
  readonly paymentMethod: Locator;
  readonly finish: Locator;
  readonly paymentSuccess: Locator;
  readonly orderConfirmation: Locator;

  constructor(private readonly page: Page) {
    this.productTitles = page.getByTestId('product-title');
    this.cartTotal = page.getByTestId('cart-total');
    this.proceedFromCart = page.getByTestId('proceed-1');

    this.signInForm = new LoginForm(page);
    this.proceedFromSignIn = page.getByTestId('proceed-2');

    this.country = page.getByTestId('country');
    this.postalCode = page.getByTestId('postal_code');
    this.houseNumber = page.getByTestId('house_number');
    this.street = page.getByTestId('street');
    this.city = page.getByTestId('city');
    this.state = page.getByTestId('state');
    this.proceedFromAddress = page.getByTestId('proceed-3');

    this.paymentMethod = page.getByTestId('payment-method');
    this.finish = page.getByTestId('finish');
    this.paymentSuccess = page.getByTestId('payment-success-message');
    this.orderConfirmation = page.locator('#order-confirmation'); // no data-test on this element
  }

  async goto(): Promise<void> {
    await this.page.goto('/checkout');
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.signInForm.signIn(email, password);
  }

  /** Enters country + postcode + house number; the app's postcode lookup fills street, city and state. */
  async enterAddressForLookup(address: Address): Promise<void> {
    await this.country.selectOption(address.country);
    await this.postalCode.fill(address.postal_code);
    await this.houseNumber.fill(address.house_number);
  }
}
