package com.showcase.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;

/**
 * Java twin of src/pages/InvoiceDetailsPage.ts. The download button stays disabled until the background job has
 * written the PDF; the page asks for its status every 20 seconds.
 */
public class InvoiceDetailsPage {
  public final Locator invoiceNumber;
  public final Locator downloadPdf;

  public InvoiceDetailsPage(Page page) {
    this.invoiceNumber = page.getByTestId("invoice-number");
    this.downloadPdf = page.getByTestId("download-invoice");
  }
}
