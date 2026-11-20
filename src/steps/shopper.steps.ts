import { expect, Given, Then, When } from '../fixtures';
import { need } from './need';

// Steps layer for features/journeys/shopper.feature (S5): what a signed-in customer does outside checkout.
// The checkout part reuses checkout.steps.ts. Java twin: java/src/test/java/com/showcase/steps/ShopperSteps.java.

const PRODUCTS = 'Given two different products that are in stock';

Given('two different products that are in stock', async ({ api, ctx }) => {
  ctx.products = await api.products.findInStockProducts(2);
});

Given('I am signed in as that customer', async ({ loginPage, page, ctx }) => {
  const customer = need(ctx.customer, 'Given a newly registered customer');
  await loginPage.open();
  await loginPage.signIn(customer.email, customer.password);
  await expect(page).toHaveURL(/\/account$/);
});

When('I add the first product to my favourites', async ({ productPage, ctx }) => {
  await productPage.open(need(ctx.products, PRODUCTS)[0].id);
  await productPage.addToFavorites();
});

Then('my favourites list only the first product', async ({ favoritesPage, ctx }) => {
  await favoritesPage.open();
  expect(await favoritesPage.productNames()).toEqual([need(ctx.products, PRODUCTS)[0].name]);
});

When('I compare both products', async ({ productPage, comparisonPage, ctx }) => {
  const products = need(ctx.products, PRODUCTS);
  for (const product of products) {
    await productPage.open(product.id);
    await productPage.addToCompare();
  }
  await comparisonPage.open();
  ctx.comparison = await comparisonPage.pricesOf(products.map((p) => p.name));
});

Then('the comparison shows both products at their catalogue prices', async ({ ctx }) => {
  const expected = new Map(need(ctx.products, PRODUCTS).map((p) => [p.name, p.price]));
  expect(need(ctx.comparison, 'When I compare both products')).toEqual(expected);
});

When('I add the cheaper product to the cart', async ({ productPage, header, ctx }) => {
  const [cheaper] = [...need(ctx.products, PRODUCTS)].sort((a, b) => a.price - b.price);
  ctx.product = cheaper; // the product the checkout steps buy
  await productPage.open(cheaper.id);
  await productPage.addToCart();
  await expect(header.cartQuantity).toHaveText('1');
});

When('I continue as the signed-in customer', async ({ checkoutPage }) => {
  await checkoutPage.continueSignedIn();
});

When('I download the invoice as a PDF', async ({ invoicesPage, invoiceDetailsPage, ctx }) => {
  const invoiceNumber = need(ctx.invoiceNumber, 'When I pay with "..."');
  await invoicesPage.open();
  await invoicesPage.openDetails(invoiceNumber);
  ctx.pdf = await invoiceDetailsPage.downloadPdf(invoiceNumber);
});

Then('the file is a PDF named after the invoice', async ({ ctx }) => {
  const pdf = need(ctx.pdf, 'When I download the invoice as a PDF');
  expect(pdf.fileName).toBe(`${ctx.invoiceNumber}.pdf`);
  expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');
});

Then('the backend has the favourite, the order at the cart total and a completed PDF', async ({ api, ctx }) => {
  const customer = need(ctx.customer, 'Given a newly registered customer');
  const invoiceNumber = need(ctx.invoiceNumber, 'When I pay with "..."');
  const token = await api.auth.login(customer.email, customer.password);
  expect((await api.favorites.list(token)).map((f) => f.product_id)).toEqual([need(ctx.products, PRODUCTS)[0].id]);
  expect((await api.invoices.findByNumber(token, invoiceNumber)).total).toBeCloseTo(
    need(ctx.cartTotal, 'When I review the cart'),
    2,
  );
  expect(await api.invoices.pdfStatus(token, invoiceNumber)).toBe('COMPLETED');
});
