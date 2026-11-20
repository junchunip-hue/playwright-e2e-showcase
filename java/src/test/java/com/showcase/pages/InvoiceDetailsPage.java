package com.showcase.pages;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.microsoft.playwright.Download;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.assertions.LocatorAssertions;
import com.showcase.modules.InvoiceDetailsModule;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;

/** Page layer: one invoice of a signed-in customer, with its PDF download. TypeScript twin: src/pages/account.page.ts. */
public class InvoiceDetailsPage {
  /** How long the invoice PDF may take: a background job writes it, and the page polls its status every 20 s. */
  private static final double PDF_READY_TIMEOUT = 180_000;

  public record PdfFile(String fileName, byte[] body) {}

  private final Page page;
  public final InvoiceDetailsModule ui;

  public InvoiceDetailsPage(Page page) {
    this.page = page;
    this.ui = new InvoiceDetailsModule(page);
  }

  /** Waits until the background job has written the PDF (the button turns enabled), then downloads it. */
  public PdfFile downloadPdf(String invoiceNumber) {
    assertThat(ui.invoiceNumber).hasValue(invoiceNumber);
    assertThat(ui.downloadPdf).isEnabled(new LocatorAssertions.IsEnabledOptions().setTimeout(PDF_READY_TIMEOUT));
    Download download = page.waitForDownload(ui.downloadPdf::click);
    try {
      return new PdfFile(download.suggestedFilename(), Files.readAllBytes(download.path()));
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }
}
