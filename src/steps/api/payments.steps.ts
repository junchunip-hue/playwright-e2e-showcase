import { invalidCards, payments } from '../../data/payments';
import { expect, Then } from '../../fixtures';

// Steps layer for features/api/payments.feature (A9). One step covers every method or card, each as its own
// Playwright step in the report. Java twin: java/src/test/java/com/showcase/steps/api/PaymentsApiSteps.java.

Then('the payment check accepts every payment method with valid details', async ({ api, $test }) => {
  const all = [payments.cashOnDelivery(), payments.bankTransfer(), payments.creditCard(), payments.buyNowPayLater(), payments.giftCard()];
  for (const payment of all) {
    // check() validates the body against PaymentCheckSchema ("Payment was successful") and throws otherwise.
    await $test.step(payment.method, () => expect(api.payments.check(payment)).resolves.toBeUndefined());
  }
});

Then('the payment check rejects each invalid card, naming only its broken field', async ({ api, $test }) => {
  for (const card of invalidCards) {
    await $test.step(card.name, async () => {
      const res = await api.payments.checkRequest(card.payment);
      expect(res.status()).toBe(422);
      expect(Object.keys(await api.payments.rejection(res))).toEqual([`payment_details.${card.field}`]);
    });
  }
});
