import type { Locator, Page } from '@playwright/test';

/** Shared navigation bar, present on every page. */
export class Header {
  readonly root: Locator;
  readonly signIn: Locator;
  readonly userMenu: Locator;
  readonly cartQuantity: Locator;
  /** Promo bar above the navigation; its content varies, so visual checks mask it. */
  readonly notificationBar: Locator;

  constructor(page: Page) {
    this.root = page.locator('nav.navbar');
    this.signIn = page.getByTestId('nav-sign-in');
    this.userMenu = page.getByTestId('nav-menu');
    this.cartQuantity = page.getByTestId('cart-quantity');
    this.notificationBar = page.getByTestId('notification-bar');
  }
}
