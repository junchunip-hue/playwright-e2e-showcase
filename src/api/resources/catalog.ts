import type { Http } from '../http';
import { BrandListSchema, CategoryListSchema, ImageListSchema } from '../schemas';

/** GET /brands, /categories, /images: the references a product needs. Public, no login. */
export class CatalogApi {
  constructor(private readonly http: Http) {}

  brands() {
    return this.http.get('/brands', BrandListSchema);
  }

  categories() {
    return this.http.get('/categories', CategoryListSchema);
  }

  images() {
    return this.http.get('/images', ImageListSchema);
  }
}
