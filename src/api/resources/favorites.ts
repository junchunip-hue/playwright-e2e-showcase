import type { Http } from '../http';
import { FavoriteCreatedSchema, FavoriteListSchema, type Favorite } from '../schemas';

/** /favorites: a signed-in customer's favourite products. */
export class FavoritesApi {
  constructor(private readonly http: Http) {}

  list(token: string): Promise<Favorite[]> {
    return this.http.get('/favorites', FavoriteListSchema, token);
  }

  /** POST /favorites. A product that is already a favourite answers 409 "Duplicate Entry". */
  async add(token: string, productId: string): Promise<void> {
    await this.http.parse(await this.http.post('/favorites', { product_id: productId }, token), 'POST /favorites', FavoriteCreatedSchema);
  }
}
