package com.showcase.flows;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.microsoft.playwright.Download;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Response;
import com.microsoft.playwright.assertions.LocatorAssertions;
import com.showcase.api.ApiClient.Product;
import com.showcase.data.Customers.Customer;
import com.showcase.pages.AccountInvoicesPage;
import com.showcase.pages.ComparisonPage;
import com.showcase.pages.FavoritesPage;
import com.showcase.pages.InvoiceDetailsPage;
import com.showcase.pages.LoginPage;
import com.showcase.pages.ProductPage;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Java twin of src/flows/ShopperFlow.ts: what a signed-in customer does outside checkout (S5), method for method.
 *
 * <pre>
 *   shopper.signIn(customer);
 *   shopper.addToFavorites(product);
 *   Map&lt;String, Double&gt; prices = shopper.compare(List.of(a, b));
 *   PdfFile pdf = shopper.downloadInvoice(invoiceNumber);
 * </pre>
 */
public class ShopperFlow {
  /** How long the invoice PDF may take: a background job writes it, and the page polls its status every 20 s. */
  private static final double PDF_READY_TIMEOUT = 180_000;

  /** A downloaded file and the name the browser was given for it. */
  public record PdfFile(String fileName, byte[] body) {}

  private final Page page;
  private final LoginPage loginPage;
  private final ProductPage productPage;
  private final ComparisonPage comparisonPage;
  private final FavoritesPage favoritesPage;
  private final AccountInvoicesPage invoicesPage;
  private final InvoiceDetailsPage invoiceDetailsPage;

  public ShopperFlow(Page page) {
    this.page = page;
    this.loginPage = new LoginPage(page);
    this.productPage = new ProductPage(page);
    this.comparisonPage = new ComparisonPage(page);
    this.favoritesPage = new FavoritesPage(page);
    this.invoicesPage = new AccountInvoicesPage(page);
    this.invoiceDetailsPage = new InvoiceDetailsPage(page);
  }

  public void signIn(Customer customer) {
    loginPage.open();
    loginPage.signIn(customer.email(), customer.password());
    assertThat(page).hasURL(Pattern.compile("/account$"));
  }

  /** Adds the product from its detail page and waits until the API has stored it. */
  public void addToFavorites(Product product) {
    productPage.open(product.id());
    Response stored = page.waitForResponse(
        r -> "POST".equals(r.request().method()) && r.url().endsWith("/favorites"),
        productPage.ui.addToFavorites::click);
    if (stored.status() != 201) throw new AssertionError("POST /favorites answered " + stored.status());
  }

  /** The product names on "My favorites". */
  public List<String> favorites() {
    favoritesPage.navigate();
    assertThat(favoritesPage.productNames.first()).isVisible();
    return favoritesPage.productNames.allTextContents().stream().map(String::trim).toList();
  }

  /** Marks each product for comparison, opens the comparison and returns the price shown per product name. */
  public Map<String, Double> compare(List<Product> products) {
    for (Product product : products) {
      productPage.open(product.id());
      productPage.ui.addToCompare.click();
    }
    comparisonPage.navigate();
    assertThat(comparisonPage.productNames).hasText(products.stream().map(Product::name).toArray(String[]::new));
    List<String> names = comparisonPage.productNames.allTextContents();
    List<String> prices = comparisonPage.prices.allTextContents();
    Map<String, Double> shown = new LinkedHashMap<>();
    for (int i = 0; i < names.size(); i++) shown.put(names.get(i).trim(), Double.parseDouble(prices.get(i).replaceAll("[^0-9.]", "")));
    return shown;
  }

  /** Opens the invoice from "My invoices", waits until its PDF is ready and downloads it. */
  public PdfFile downloadInvoice(String invoiceNumber) {
    invoicesPage.navigate();
    invoicesPage.details(invoiceNumber).click();
    assertThat(invoiceDetailsPage.invoiceNumber).hasValue(invoiceNumber);
    assertThat(invoiceDetailsPage.downloadPdf).isEnabled(new LocatorAssertions.IsEnabledOptions().setTimeout(PDF_READY_TIMEOUT));

    Download download = page.waitForDownload(invoiceDetailsPage.downloadPdf::click);
    try {
      return new PdfFile(download.suggestedFilename(), Files.readAllBytes(download.path()));
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }
}
