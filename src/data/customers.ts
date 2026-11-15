import { randomUUID } from 'node:crypto';
import type { ApiClient, NewCustomer } from '../api/ApiClient';

/**
 * Creates a brand-new customer through the API.
 * Every test gets its own account, so tests never share carts, orders or invoices
 * and can run in parallel and in any order.
 */
export async function createCustomer(api: ApiClient): Promise<NewCustomer> {
  const id = randomUUID().slice(0, 8);
  const address = await api.lookupAddress('US', '90210', '1');

  const customer: NewCustomer = {
    first_name: 'Test',
    last_name: `Buyer${id}`,
    email: `buyer.${id}@example.com`,
    // Meets the API policy (mixed case, digit, symbol) and is random, so the "not compromised" check passes.
    password: `Pw!${id}Aa1`,
    dob: '1990-01-01',
    phone: '0612345678',
    address,
  };

  await api.registerCustomer(customer);
  return customer;
}
