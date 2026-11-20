package com.showcase.modules;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;

/**
 * Module layer: one invoice (/account/invoices/{id}). The download button stays disabled until the
 * background job has written the PDF; the page asks for its status every 20 seconds. TypeScript
 * twin: src/modules/account.module.ts.
 */
public class InvoiceDetailsModule {
  public final Locator invoiceNumber;
  public final Locator downloadPdf;

  public InvoiceDetailsModule(Page page) {
    this.invoiceNumber = page.getByTestId("invoice-number");
    this.downloadPdf = page.getByTestId("download-invoice");
  }
}
