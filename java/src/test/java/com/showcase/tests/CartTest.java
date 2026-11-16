package com.showcase.tests;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.showcase.annotations.SmokeTest;
import com.showcase.annotations.ToolshopTest;
import com.showcase.api.ApiClient;
import com.showcase.api.ApiClient.Product;
import com.showcase.config.Env;
import com.showcase.pages.Header;
import com.showcase.pages.LoginPage;
import com.showcase.pages.ProductPage;
import java.util.regex.Pattern;
import org.junit.jupiter.api.DisplayName;

/**
 * Mirrors tests/ui/cart.spec.ts. The TypeScript suite reuses a saved login session (setup project);
 * here the test signs in itself, which keeps the Java module free of cross-test state.
 */
@ToolshopTest
@DisplayName("Cart (logged-in customer)")
class CartTest {

  @SmokeTest
  @DisplayName("adding a product updates the cart badge")
  void addToCartUpdatesBadge(Page page, Playwright playwright) {
    Product product;
    try (ApiClient api = ApiClient.create(playwright)) {
      // Hybrid setup: the API picks a product that is actually in stock right now.
      product = api.findInStockProduct();
    }

    LoginPage loginPage = new LoginPage(page);
    loginPage.navigate();
    loginPage.login(Env.CUSTOMER_EMAIL, Env.CUSTOMER_PASSWORD);
    assertThat(page).hasURL(Pattern.compile("/account"));

    ProductPage productPage = new ProductPage(page);
    productPage.navigate(product.id());
    assertThat(productPage.name).hasText(product.name());
    productPage.addToCart.click();

    assertThat(new Header(page).cartQuantity).hasText("1");
  }
}
