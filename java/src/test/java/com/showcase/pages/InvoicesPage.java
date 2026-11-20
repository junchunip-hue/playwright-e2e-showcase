package com.showcase.pages;

import com.microsoft.playwright.Page;
import com.showcase.modules.InvoicesModule;

/**
 * Page layer: "My invoices" of a signed-in customer. TypeScript twin: src/pages/account.page.ts.
 */
public class InvoicesPage {
  private final Page page;
  public final InvoicesModule ui;

  public InvoicesPage(Page page) {
    this.page = page;
    this.ui = new InvoicesModule(page);
  }

  public void open() {
    page.navigate("/account/invoices");
  }

  public void openDetails(String invoiceNumber) {
    ui.details(invoiceNumber).click();
  }
}
