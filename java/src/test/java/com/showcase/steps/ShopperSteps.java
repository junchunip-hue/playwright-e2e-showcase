package com.showcase.steps;

import static com.showcase.steps.ScenarioContext.need;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.showcase.api.ApiClient;
import com.showcase.api.ApiClient.Product;
import com.showcase.data.Customers.Customer;
import com.showcase.pages.CheckoutPage;
import com.showcase.pages.ComparisonPage;
import com.showcase.pages.FavoritesPage;
import com.showcase.pages.InvoiceDetailsPage;
import com.showcase.pages.InvoiceDetailsPage.PdfFile;
import com.showcase.pages.InvoicesPage;
import com.showcase.pages.ProductPage;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Steps layer for features/journeys/shopper.feature (S5): what a signed-in customer does outside
 * checkout. The checkout part reuses CheckoutSteps. TypeScript twin: src/steps/shopper.steps.ts.
 */
public class ShopperSteps {
  private static final String PRODUCTS = "Given two different products that are in stock";
  private static final String PAID = "When I pay with \"...\"";
  private final PlaywrightContext playwright;
  private final ScenarioContext ctx;

  public ShopperSteps(PlaywrightContext playwright, ScenarioContext ctx) {
    this.playwright = playwright;
    this.ctx = ctx;
  }

  private List<Product> products() {
    return need(ctx.products, PRODUCTS);
  }

  @Given("two different products that are in stock")
  public void twoDifferentProductsThatAreInStock() {
    ctx.products = playwright.api().findInStockProducts(2);
  }

  @When("I add the first product to my favourites on its product page")
  public void iAddTheFirstProductToMyFavourites() {
    ProductPage productPage = new ProductPage(playwright.page());
    productPage.open(products().get(0).id());
    productPage.addToFavorites();
  }

  @Then("my favourites list only the first product")
  public void myFavouritesListOnlyTheFirstProduct() {
    FavoritesPage favorites = new FavoritesPage(playwright.page());
    favorites.open();
    assertEquals(List.of(products().get(0).name()), favorites.productNames());
  }

  @When("I compare both products")
  public void iCompareBothProducts() {
    ProductPage productPage = new ProductPage(playwright.page());
    for (Product product : products()) {
      productPage.open(product.id());
      productPage.addToCompare();
    }
    ComparisonPage comparison = new ComparisonPage(playwright.page());
    comparison.open();
    ctx.comparison = comparison.pricesOf(products().stream().map(Product::name).toList());
  }

  @Then("the comparison shows both products at their catalogue prices")
  public void theComparisonShowsBothProductsAtTheirCataloguePrices() {
    Map<String, Double> expected = new LinkedHashMap<>();
    products().forEach(p -> expected.put(p.name(), p.price()));
    assertEquals(expected, need(ctx.comparison, "When I compare both products"));
  }

  @When("I choose the cheaper of the two products")
  public void iChooseTheCheaperOfTheTwoProducts() {
    // the product the next steps open, add to the cart and buy
    ctx.product = products().stream().min(Comparator.comparingDouble(Product::price)).orElseThrow();
  }

  @When("I continue as the signed-in customer")
  public void iContinueAsTheSignedInCustomer() {
    new CheckoutPage(playwright.page()).continueSignedIn();
  }

  @When("I download the invoice as a PDF")
  public void iDownloadTheInvoiceAsAPdf() {
    String invoiceNumber = need(ctx.invoiceNumber, PAID);
    InvoicesPage invoices = new InvoicesPage(playwright.page());
    invoices.open();
    invoices.openDetails(invoiceNumber);
    ctx.pdf = new InvoiceDetailsPage(playwright.page()).downloadPdf(invoiceNumber);
  }

  @Then("the file is a PDF named after the invoice")
  public void theFileIsAPdfNamedAfterTheInvoice() {
    PdfFile pdf = need(ctx.pdf, "When I download the invoice as a PDF");
    assertEquals(ctx.invoiceNumber + ".pdf", pdf.fileName());
    assertEquals("%PDF-", new String(Arrays.copyOf(pdf.body(), 5), StandardCharsets.US_ASCII));
  }

  @Then("the backend has the favourite, the order at the cart total and a completed PDF")
  public void theBackendHasTheFavouriteTheOrderAndACompletedPdf() {
    Customer customer = ctx.customer();
    String invoiceNumber = need(ctx.invoiceNumber, PAID);
    ApiClient api = playwright.api();
    String token = api.login(customer.email(), customer.password());
    assertEquals(
        List.of(products().get(0).id()),
        api.favorites(token).stream().map(f -> f.productId()).toList());
    assertEquals(
        need(ctx.cartTotal, "When I review the cart"),
        api.findInvoiceByNumber(token, invoiceNumber).total(),
        0.01);
    assertEquals("COMPLETED", api.pdfStatus(token, invoiceNumber));
  }
}
