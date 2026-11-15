import type { Locator, Page } from '@playwright/test';

/** Shared navigation bar, present on every page. */
export class Header {
  readonly signIn: Locator;
  readonly userMenu: Locator;
  readonly cartQuantity: Locator;

  constructor(page: Page) {
    this.signIn = page.getByTestId('nav-sign-in');
    this.userMenu = page.getByTestId('nav-menu');
    this.cartQuantity = page.getByTestId('cart-quantity');
  }
}
