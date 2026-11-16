import { expect, Tag, test } from '../../src/fixtures';

test.describe('Cart (logged-in customer)', () => {
  test('adding a product updates the cart badge', { tag: [Tag.smoke] }, async ({ api, productPage, header }) => {
    // Hybrid setup: the API picks a product that is actually in stock right now,
    // so the test does not break when the shared demo server's inventory changes.
    const product = await api.findInStockProduct();

    await productPage.goto(product.id);
    await expect(productPage.name).toHaveText(product.name);
    await productPage.addToCart.click();

    await expect(header.cartQuantity).toHaveText('1');
  });
});
