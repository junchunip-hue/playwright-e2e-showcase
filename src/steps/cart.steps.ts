import { expect, Then, When } from '../fixtures';

// Steps layer for features/ui/cart.feature. Java twin: java/src/test/java/com/showcase/steps/CartSteps.java.

When("I open that product's page", async ({ productPage, ctx }) => {
  if (!ctx.product) throw new Error('No product yet: add "Given a product that is in stock" first');
  await productPage.open(ctx.product.id);
});

Then('the product page shows that product', async ({ productPage, ctx }) => {
  expect(await productPage.productName()).toBe(ctx.product!.name);
});

When('I add it to the cart on the product page', async ({ productPage }) => {
  await productPage.addToCart();
});

Then('the cart badge shows {int}', async ({ header }, count: number) => {
  await expect(header.cartQuantity).toHaveText(String(count));
});
