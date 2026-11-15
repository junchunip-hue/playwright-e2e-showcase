package com.showcase.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;

/** Java twin of src/pages/components/Header.ts: shared navigation bar. */
public class Header {
  public final Locator userMenu;
  public final Locator cartQuantity;

  public Header(Page page) {
    this.userMenu = page.getByTestId("nav-menu");
    this.cartQuantity = page.getByTestId("cart-quantity");
  }
}
