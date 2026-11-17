import { randomUUID } from 'node:crypto';
import type { ApiClient, NewProduct } from '../api/ApiClient';

/**
 * A brand-new, buyable product with a unique name, built from the catalogue's own brands, sub-categories and
 * images (so references are always valid on a freshly seeded Toolshop).
 */
export async function newProductData(api: ApiClient): Promise<NewProduct> {
  const id = randomUUID().slice(0, 8);
  const [brands, categories, images] = await Promise.all([api.catalog.brands(), api.catalog.categories(), api.catalog.images()]);
  const subCategory = categories.find((c) => c.parent_id !== null) ?? categories[0];

  return {
    name: `Showcase Drill ${id}`,
    description: 'Published by the S3 journey test.',
    price: 19.99,
    category_id: subCategory.id,
    brand_id: brands[0].id,
    product_image_id: images[0].id,
    is_location_offer: false,
    is_rental: false,
    stock: 10,
  };
}
