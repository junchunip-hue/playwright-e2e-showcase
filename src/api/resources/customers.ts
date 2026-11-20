import type { APIResponse } from '@playwright/test';

import type { Http } from '../http';
import type { Address } from './addresses';

/** Request body of POST /users/register (our own test data, so a plain type rather than a response schema). */
export interface NewCustomer {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  dob: string;
  phone: string;
  address: Address;
}

/** POST /users/register. Test data is built in src/data/customers.ts. */
export class CustomersApi {
  constructor(private readonly http: Http) {}

  /** Raw response, for tests that expect a rejected registration. */
  registerRequest(customer: NewCustomer): Promise<APIResponse> {
    return this.http.post('/users/register', customer);
  }

  async register(customer: NewCustomer): Promise<void> {
    await this.http.ensureOk(await this.registerRequest(customer), 'POST /users/register');
  }
}
