package com.showcase.modules;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/** Module layer: "My invoices" (/account/invoices); the table has no data-test ids. TypeScript twin: src/modules/account.module.ts. */
public class InvoicesModule {
  public final Locator rows;

  public InvoicesModule(Page page) {
    this.rows = page.locator("table tbody tr");
  }

  public Locator row(String invoiceNumber) {
    return rows.filter(new Locator.FilterOptions().setHasText(invoiceNumber));
  }

  /** The row's "Details" link (a router link without data-test). */
  public Locator details(String invoiceNumber) {
    return row(invoiceNumber).getByRole(AriaRole.LINK);
  }
}
