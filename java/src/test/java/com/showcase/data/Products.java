package com.showcase.data;

import com.showcase.api.ApiClient;
import com.showcase.api.ApiClient.Ref;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Java twin of src/data/products.ts: a brand-new, buyable product built from the catalogue's own references. */
public final class Products {
  private Products() {}

  public static Map<String, Object> newProductData(ApiClient api) {
    String id = UUID.randomUUID().toString().substring(0, 8);
    List<Ref> categories = api.categories();
    Ref subCategory = categories.stream().filter(c -> c.parentId() != null).findFirst().orElse(categories.get(0));

    return Map.of(
        "name", "Showcase Drill " + id,
        "description", "Published by the S3 journey test.",
        "price", 19.99,
        "category_id", subCategory.id(),
        "brand_id", api.brands().get(0).id(),
        "product_image_id", api.images().get(0).id(),
        "is_location_offer", false,
        "is_rental", false,
        "stock", 10);
  }
}
