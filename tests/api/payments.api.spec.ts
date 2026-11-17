import { invalidCards, payments } from '../../src/data/payments';
import { expect, Tag, test } from '../../src/fixtures';

// A9: POST /payment/check, the server-side twin of the payment form's validation (pinned PaymentController::check).
// The same Payment objects drive the UI journeys in tests/e2e/payments.spec.ts.

test.describe('Payment check API', () => {
  test('A9: accepts every payment method with valid details', { tag: [Tag.smoke] }, async ({ api }) => {
    const all = [payments.cashOnDelivery(), payments.bankTransfer(), payments.creditCard(), payments.buyNowPayLater(), payments.giftCard()];

    for (const payment of all) {
      // check() validates the body against PaymentCheckSchema ("Payment was successful") and throws otherwise.
      await test.step(payment.method, () => expect(api.payments.check(payment)).resolves.toBeUndefined());
    }
  });

  test('A9: rejects an invalid card, naming only the broken field', { tag: [Tag.smoke, Tag.negative] }, async ({ api }) => {
    for (const card of invalidCards) {
      await test.step(card.name, async () => {
        const res = await api.payments.checkRequest(card.payment);

        expect(res.status()).toBe(422);
        expect(Object.keys(await api.payments.rejection(res))).toEqual([`payment_details.${card.field}`]);
      });
    }
  });
});
