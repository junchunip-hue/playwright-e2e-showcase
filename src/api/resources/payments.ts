import type { APIResponse } from '@playwright/test';
import type { Payment } from '../../data/payments';
import type { Http } from '../http';
import { LaravelValidationErrorSchema, PaymentCheckSchema, type ValidationErrors } from '../schemas';

/** POST /payment/check: the pre-check the checkout form runs on the first "Finish" click. No login needed. */
export class PaymentsApi {
  constructor(private readonly http: Http) {}

  /** Raw response, for tests that expect a rejected payment. */
  checkRequest(payment: Payment): Promise<APIResponse> {
    return this.http.post('/payment/check', { payment_method: payment.method, payment_details: payment.details });
  }

  /** Succeeds only for an accepted payment. */
  async check(payment: Payment): Promise<void> {
    await this.http.parse(await this.checkRequest(payment), 'POST /payment/check', PaymentCheckSchema);
  }

  /** Field errors of a rejected check, keyed like `payment_details.credit_card_number`. */
  async rejection(res: APIResponse): Promise<ValidationErrors> {
    return (await this.http.body(res, 'POST /payment/check error body', LaravelValidationErrorSchema)).errors;
  }
}
