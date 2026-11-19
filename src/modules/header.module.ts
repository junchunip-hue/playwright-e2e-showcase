import type { Locator, Page } from '@playwright/test';

/**
 * Module layer: the navigation bar, present on every page. Only locators and no page of its own: nothing is done
 * in the header that is not a link or a badge to check. Java twin: modules/HeaderModule.java.
 */
export class HeaderModule {
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
