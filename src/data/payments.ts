/**
 * Payment test data in the API's own shape (POST /payment/check): `method` + `details`.
 * The checkout form uses the same names as data-test ids (e.g. `credit_card_number`), so one object drives
 * both the UI (CheckoutFlow) and the API (api.payments.check).
 * Formats follow the pinned Toolshop rules (PaymentController::check and the payment form's validators).
 */
export type PaymentMethod = 'bank-transfer' | 'cash-on-delivery' | 'credit-card' | 'buy-now-pay-later' | 'gift-card';

export interface Payment {
  method: PaymentMethod;
  /** data-test id / API field → value; `monthly_installments` is a select, everything else a text field. */
  details: Record<string, string>;
}

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
  { name: 'malformed card number', payment: payments.creditCard({ credit_card_number: '1234' }), field: 'credit_card_number' },
  { name: 'expired card', payment: payments.creditCard({ expiration_date: '01/2020' }), field: 'expiration_date' },
] as const;
