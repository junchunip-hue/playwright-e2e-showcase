package com.showcase.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;

/** Java twin of src/pages/AccountInvoicesPage.ts: "My invoices" of a signed-in customer. No data-test ids. */
public class AccountInvoicesPage {
  private final Page page;
  public final Locator rows;

  public AccountInvoicesPage(Page page) {
    this.page = page;
    this.rows = page.locator("table tbody tr");
  }

  public void navigate() {
    page.navigate("/account/invoices");
  }

  public Locator row(String invoiceNumber) {
    return rows.filter(new Locator.FilterOptions().setHasText(invoiceNumber));
  }

  /** The row's "Details" link (a router link without data-test). */
  public Locator details(String invoiceNumber) {
    return row(invoiceNumber).getByRole(com.microsoft.playwright.options.AriaRole.LINK);
  }
}
