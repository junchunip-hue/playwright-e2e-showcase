import type { Http } from '../http';
import { PostcodeLookupSchema } from '../schemas';

/** Address as our test data and the checkout form use it (the lookup endpoint calls the postcode `postcode`). */
export interface Address {
  street: string;
  house_number: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
}

/** GET /postcode-lookup */
export class AddressesApi {
  constructor(private readonly http: Http) {}

  /**
   * The lookup the checkout form uses. Toolshop validates at checkout that city/state belong to the postcode,
   * so test addresses come from this endpoint instead of being invented.
   */
  async lookup(country: string, postcode: string, houseNumber: string): Promise<Address> {
    const query = new URLSearchParams({ country, postcode, house_number: houseNumber });
    const { postcode: postalCode, ...rest } = await this.http.get(`/postcode-lookup?${query}`, PostcodeLookupSchema);
    return { ...rest, postal_code: postalCode };
  }
}
