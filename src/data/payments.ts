import type { Payment } from '../api/ApiClient';

/**
 * Payment test data in the API's own shape (POST /payment/check, the Payment type of the API layer).
 * The checkout form uses the same names as data-test ids (e.g. `credit_card_number`), so one object drives
 * both the UI (pages/checkout.page.ts) and the API (api.payments.check).
 * Formats follow the pinned Toolshop rules (PaymentController::check and the payment form's validators).
 */

/** A card expiry that is always in the future: December of next year, as MM/YYYY. */
const nextYearExpiry = (): string => `12/${new Date().getFullYear() + 1}`;

export const payments = {
  cashOnDelivery: (): Payment => ({ method: 'cash-on-delivery', details: {} }),
  bankTransfer: (): Payment => ({
    method: 'bank-transfer',
    details: { bank_name: 'Test Bank', account_name: 'Test Buyer', account_number: '12345678' },
  }),
  creditCard: (overrides: Record<string, string> = {}): Payment => ({
    method: 'credit-card',
    details: {
      credit_card_number: '4111-1111-1111-1111',
      expiration_date: nextYearExpiry(),
      cvv: '123',
      card_holder_name: 'Test Buyer',
      ...overrides,
    },
  }),
  buyNowPayLater: (): Payment => ({ method: 'buy-now-pay-later', details: { monthly_installments: '6' } }),
  giftCard: (): Payment => ({
    method: 'gift-card',
    details: { gift_card_number: 'ABCD1234EFGH5678', validation_code: 'AB12' },
  }),
};

/** Invalid cards, each breaking one rule; `field` is the input the UI must flag. */
export const invalidCards = [
  {
    name: 'malformed card number',
    payment: payments.creditCard({ credit_card_number: '1234' }),
    field: 'credit_card_number',
  },
  { name: 'expired card', payment: payments.creditCard({ expiration_date: '01/2020' }), field: 'expiration_date' },
] as const;

export type InvalidCard = (typeof invalidCards)[number];

/** The payment for a method name as the features write it ("credit-card"), with valid details. */
export function paymentFor(method: string): Payment {
  const all: Payment[] = [
    payments.cashOnDelivery(),
    payments.bankTransfer(),
    payments.creditCard(),
    payments.buyNowPayLater(),
    payments.giftCard(),
  ];
  const found = all.find((p) => p.method === method);
  if (!found) throw new Error(`Unknown payment method "${method}". Known: ${all.map((p) => p.method).join(', ')}`);
  return found;
}

/** An invalid card by its name as the features write it ("expired card"). */
export function invalidCardNamed(name: string): InvalidCard {
  const found = invalidCards.find((c) => c.name === name);
  if (!found) throw new Error(`Unknown invalid card "${name}". Known: ${invalidCards.map((c) => c.name).join(', ')}`);
  return found;
}
