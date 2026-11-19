import type { Locator, Page } from '@playwright/test';
import { LoginModule } from './login.module';

/**
 * Module layer: locators of the 4-step checkout wizard (cart → sign in → billing address → payment).
 * Java twin: modules/CheckoutModule.java.
 */
export class CheckoutModule {
  // Step 1: cart
  readonly productTitles: Locator;
  readonly cartTotal: Locator;
  readonly proceedFromCart: Locator;
  // Step 2: sign in (the same form as on the login page)
  readonly signIn: LoginModule;
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

    this.signIn = new LoginModule(page);
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

  /** A payment detail field; its data-test id is also the API field name (see src/data/payments.ts). */
  paymentField(name: string): Locator {
    return this.page.getByTestId(name);
  }
}
