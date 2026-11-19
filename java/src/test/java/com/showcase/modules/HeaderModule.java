package com.showcase.modules;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;

/**
 * Module layer: the navigation bar, present on every page. Only locators and no page of its own: nothing is done in
 * the header that is not a link or a badge to check. TypeScript twin: src/modules/header.module.ts.
 */
public class HeaderModule {
  public final Locator userMenu;
  public final Locator cartQuantity;

  public HeaderModule(Page page) {
    this.userMenu = page.getByTestId("nav-menu");
    this.cartQuantity = page.getByTestId("cart-quantity");
  }
}
