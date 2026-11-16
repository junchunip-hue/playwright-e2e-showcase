import { randomUUID } from 'node:crypto';
import type { ApiClient, NewCustomer } from '../api/ApiClient';

/**
 * Valid registration data for a brand-new customer, not yet registered.
 * Tests override single fields (e.g. a weak password) to exercise one validation rule at a time.
 */
export async function newCustomerData(api: ApiClient, overrides: Partial<NewCustomer> = {}): Promise<NewCustomer> {
  const id = randomUUID().slice(0, 8);
  return {
    first_name: 'Test',
    last_name: `Buyer${id}`,
    email: `buyer.${id}@example.com`,
    // Meets the API policy (mixed case, digit, symbol) and is random, so the "not compromised" check passes.
    password: `Pw!${id}Aa1`,
    dob: '1990-01-01',
    phone: '0612345678',
    // Toolshop validates at checkout that city/state belong to the postcode, so the address comes from its lookup.
    address: await api.addresses.lookup('US', '90210', '1'),
    ...overrides,
  };
}

/**
 * Registers a brand-new customer through the API.
 * Every test gets its own account, so tests never share carts, orders or invoices
 * and can run in parallel and in any order.
 */
export async function createCustomer(api: ApiClient): Promise<NewCustomer> {
  const customer = await newCustomerData(api);
  await api.customers.register(customer);
  return customer;
}
