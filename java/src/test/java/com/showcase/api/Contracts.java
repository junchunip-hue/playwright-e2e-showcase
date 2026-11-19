package com.showcase.api;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import java.util.ArrayList;
import java.util.List;
import java.util.function.BiConsumer;
import java.util.regex.Pattern;

/**
 * Java twin of src/api/schemas.ts: the same response contracts, rule for rule, so both suites reject the same
 * responses. Each check returns problems as "path: message (got value)"; {@link #require} turns them into a failure.
 * Objects are not strict: extra fields are allowed, missing or retyped fields are not (except where noted).
 */
public final class Contracts {
  // ULIDs are case-insensitive: seeded rows use upper case, rows Laravel creates at runtime (invoices) lower case.
  private static final Pattern ULID = Pattern.compile("(?i)^[0-9A-HJKMNP-TV-Z]{26}$");
  private static final Pattern INVOICE_NUMBER = Pattern.compile("^INV-\\d+$");
  private static final List<String> PDF_STATUSES = List.of("NOT_INITIATED", "INITIATED", "IN_PROGRESS", "COMPLETED");

  private Contracts() {}

  /** Throws with every problem when the body breaks its contract (TS: Http.parse → z.prettifyError). */
  public static void require(String label, List<String> problems) {
    if (!problems.isEmpty()) {
      throw new IllegalStateException(label + " does not match its contract:\n  " + String.join("\n  ", problems));
    }
  }

  /** ProductSchema; {@code withSlug=false} is ProductSearchItemSchema (search omits category.slug, a known API quirk). */
  public static List<String> product(JsonObject p, boolean withSlug) {
    Check c = new Check();
    product(c, p, "", withSlug);
    return c.problems;
  }

  /** Laravel paginator envelope with every item checked; `from`/`to` are null on an empty page. */
  public static List<String> paginator(JsonObject page, BiConsumer<Check, JsonObject> item) {
    Check c = new Check();
    c.integer(page, "current_page", 1);
    c.nullableInteger(page, "from");
    c.nullableInteger(page, "to");
    c.integer(page, "last_page", 0);
    c.integer(page, "per_page", 1);
    c.integer(page, "total", 0);
    JsonElement data = page.get("data");
    if (data == null || !data.isJsonArray()) c.problem("data", "expected an array", data);
    else for (int i = 0; i < data.getAsJsonArray().size(); i++) {
      JsonElement e = data.getAsJsonArray().get(i);
      if (!e.isJsonObject()) c.problem("data[" + i + "]", "expected an object", e);
      else item.accept(c.at("data[" + i + "]."), e.getAsJsonObject());
    }
    return c.problems;
  }

  public static BiConsumer<Check, JsonObject> productItem(boolean withSlug) {
    return (c, p) -> product(c, p, "", withSlug);
  }

  public static List<String> login(JsonObject b) {
    Check c = new Check();
    c.string(b, "access_token", 1);
    c.literal(b, "token_type", "bearer");
    c.integer(b, "expires_in", 1);
    return c.problems;
  }

  public static List<String> postcodeLookup(JsonObject b) {
    Check c = new Check();
    c.string(b, "street", 1);
    c.string(b, "house_number", 0);
    c.string(b, "city", 1);
    c.string(b, "state", 0);
    c.exactLength(b, "country", 2);
    c.string(b, "postcode", 1);
    return c.problems;
  }

  public static BiConsumer<Check, JsonObject> invoiceItem() {
    return (c, i) -> {
      c.matches(i, "id", ULID, "expected a ULID");
      c.matches(i, "invoice_number", INVOICE_NUMBER, "expected INV-<digits>");
      c.string(i, "invoice_date", 0);
      c.string(i, "billing_street", 0);
      c.string(i, "billing_city", 0);
      c.nullableString(i, "billing_state");
      c.string(i, "billing_country", 0);
      c.nullableString(i, "billing_postal_code");
      c.nullableNumber(i, "subtotal");
      c.number(i, "total", false);
      c.string(i, "status", 1);
    };
  }

  /** GET /invoices/{id} (TS: InvoiceDetailSchema): the list fields plus the status message. */
  public static List<String> invoiceDetail(JsonObject b) {
    Check c = new Check();
    invoiceItem().accept(c, b);
    c.nullableString(b, "status_message");
    return c.problems;
  }

  /** PUT /invoices/{id}/status (TS: StatusUpdatedSchema). */
  public static List<String> statusUpdated(JsonObject b) {
    Check c = new Check();
    JsonElement v = b.get("success");
    if (v == null || !v.isJsonPrimitive() || !v.getAsJsonPrimitive().isBoolean() || !v.getAsBoolean()) c.problem("success", "expected true", v);
    return c.problems;
  }

  /** POST /products (TS: CreatedProductSchema): the stored product, relations not loaded yet. */
  public static List<String> createdProduct(JsonObject b) {
    Check c = new Check();
    c.matches(b, "id", ULID, "expected a ULID");
    c.string(b, "name", 1);
    c.number(b, "price", false);
    return c.problems;
  }

  /** A non-empty plain array with every item checked (TS: BrandListSchema, CategoryListSchema, ImageListSchema). */
  public static List<String> list(JsonArray items, BiConsumer<Check, JsonObject> item) {
    Check c = new Check();
    if (items.isEmpty()) c.problem("(root)", "expected at least one item", items);
    for (int i = 0; i < items.size(); i++) {
      JsonElement e = items.get(i);
      if (!e.isJsonObject()) c.problem("[" + i + "]", "expected an object", e);
      else item.accept(c.at("[" + i + "]."), e.getAsJsonObject());
    }
    return c.problems;
  }

  public static BiConsumer<Check, JsonObject> brandItem() {
    return (c, o) -> {
      c.matches(o, "id", ULID, "expected a ULID");
      c.string(o, "name", 1);
      c.string(o, "slug", 1);
    };
  }

  public static BiConsumer<Check, JsonObject> categoryItem() {
    return (c, o) -> {
      brandItem().accept(c, o);
      JsonElement parent = o.get("parent_id");
      if (parent != null && !parent.isJsonNull()) c.matches(o, "parent_id", ULID, "expected a ULID or null");
      else if (parent == null) c.problem("parent_id", "expected a ULID or null", null);
    };
  }

  public static BiConsumer<Check, JsonObject> imageItem() {
    return (c, o) -> {
      c.matches(o, "id", ULID, "expected a ULID");
      c.string(o, "file_name", 1);
      for (String f : List.of("title", "by_name", "by_url", "source_name", "source_url")) c.string(o, f, 0);
    };
  }

  /** GET /favorites (TS: FavoriteListSchema): every favourite with its product. May be empty. */
  public static List<String> favorites(JsonArray items) {
    Check c = new Check();
    for (int i = 0; i < items.size(); i++) {
      JsonElement e = items.get(i);
      if (!e.isJsonObject()) {
        c.problem("[" + i + "]", "expected an object", e);
        continue;
      }
      Check at = c.at("[" + i + "].");
      JsonObject f = e.getAsJsonObject();
      at.matches(f, "id", ULID, "expected a ULID");
      at.matches(f, "user_id", ULID, "expected a ULID");
      at.matches(f, "product_id", ULID, "expected a ULID");
      at.object(f, "product", (pc, p) -> {
        pc.matches(p, "id", ULID, "expected a ULID");
        pc.string(p, "name", 1);
        pc.number(p, "price", false);
      });
    }
    return c.problems;
  }

  /** GET /invoices/{number}/download-pdf-status (TS: PdfStatusSchema). */
  public static List<String> pdfStatus(JsonObject b) {
    Check c = new Check();
    JsonElement v = b.get("status");
    if (v == null || !v.isJsonPrimitive() || !PDF_STATUSES.contains(v.getAsString())) c.problem("status", "expected one of " + PDF_STATUSES, v);
    return c.problems;
  }

  /** Rejected request body: field → non-empty list of non-empty messages (TS: ValidationErrorsSchema). */
  public static List<String> validationErrors(JsonObject b) {
    Check c = new Check();
    if (b.isEmpty()) c.problem("(root)", "expected at least one field", b);
    for (String field : b.keySet()) {
      JsonElement v = b.get(field);
      if (!v.isJsonArray() || v.getAsJsonArray().isEmpty()) c.problem(field, "expected a non-empty array", v);
      else v.getAsJsonArray().forEach(m -> {
        if (!m.isJsonPrimitive() || !m.getAsJsonPrimitive().isString() || m.getAsString().isEmpty()) {
          c.problem(field, "expected non-empty messages", m);
        }
      });
    }
    return c.problems;
  }

  private static void product(Check c, JsonObject p, String prefix, boolean withSlug) {
    Check at = c.at(prefix);
    at.matches(p, "id", ULID, "expected a ULID");
    at.string(p, "name", 1);
    at.string(p, "description", 0);
    at.number(p, "price", true);
    at.bool(p, "is_location_offer");
    at.bool(p, "is_rental");
    at.bool(p, "in_stock");
    // Optional on create, so products published later return null (seeded ones all have a rating). Found by A8/S3.
    at.nullableString(p, "co2_rating");
    at.bool(p, "is_eco_friendly");

    at.object(p, "brand", (b, o) -> {
      b.matches(o, "id", ULID, "expected a ULID");
      b.string(o, "name", 1);
    });
    at.object(p, "category", (b, o) -> {
      b.matches(o, "id", ULID, "expected a ULID");
      b.string(o, "name", 1);
      if (withSlug) b.string(o, "slug", 1);
      else if (o.has("slug")) b.problem("slug", "not expected in search results (contract records its absence)", o.get("slug"));
    });
    at.object(p, "product_image", (b, o) -> {
      b.matches(o, "id", ULID, "expected a ULID");
      b.string(o, "file_name", 1);
      for (String f : List.of("title", "by_name", "by_url", "source_name", "source_url")) b.string(o, f, 0);
    });
  }

  /** Collects problems under a path prefix; nested objects get a nested prefix. */
  public static final class Check {
    private final List<String> problems;
    private final String prefix;

    Check() {
      this(new ArrayList<>(), "");
    }

    private Check(List<String> problems, String prefix) {
      this.problems = problems;
      this.prefix = prefix;
    }

    Check at(String more) {
      return new Check(problems, prefix + more);
    }

    void problem(String field, String message, JsonElement got) {
      String value = got == null ? "missing" : got.toString();
      problems.add(prefix + field + ": " + message + " (got " + value.substring(0, Math.min(120, value.length())) + ")");
    }

    void string(JsonObject o, String f, int minLength) {
      JsonElement v = o.get(f);
      if (v == null || !v.isJsonPrimitive() || !v.getAsJsonPrimitive().isString()) problem(f, "expected a string", v);
      else if (v.getAsString().length() < minLength) problem(f, "expected at least " + minLength + " characters", v);
    }

    void nullableString(JsonObject o, String f) {
      JsonElement v = o.get(f);
      if (v != null && v.isJsonNull()) return;
      string(o, f, 0);
    }

    void exactLength(JsonObject o, String f, int length) {
      string(o, f, length);
      JsonElement v = o.get(f);
      if (v != null && v.isJsonPrimitive() && v.getAsString().length() > length) problem(f, "expected " + length + " characters", v);
    }

    void literal(JsonObject o, String f, String expected) {
      JsonElement v = o.get(f);
      if (v == null || !v.isJsonPrimitive() || !expected.equals(v.getAsString())) problem(f, "expected \"" + expected + "\"", v);
    }

    void matches(JsonObject o, String f, Pattern pattern, String message) {
      string(o, f, 0);
      JsonElement v = o.get(f);
      if (v != null && v.isJsonPrimitive() && v.getAsJsonPrimitive().isString() && !pattern.matcher(v.getAsString()).matches()) {
        problem(f, message, v);
      }
    }

    void bool(JsonObject o, String f) {
      JsonElement v = o.get(f);
      if (v == null || !v.isJsonPrimitive() || !v.getAsJsonPrimitive().isBoolean()) problem(f, "expected a boolean", v);
    }

    void number(JsonObject o, String f, boolean positive) {
      JsonElement v = o.get(f);
      if (v == null || !v.isJsonPrimitive() || !v.getAsJsonPrimitive().isNumber()) problem(f, "expected a number", v);
      else if (positive && v.getAsDouble() <= 0) problem(f, "expected a positive number", v);
    }

    void nullableNumber(JsonObject o, String f) {
      JsonElement v = o.get(f);
      if (v != null && v.isJsonNull()) return;
      number(o, f, false);
    }

    void integer(JsonObject o, String f, int min) {
      number(o, f, false);
      JsonElement v = o.get(f);
      if (v != null && v.isJsonPrimitive() && v.getAsJsonPrimitive().isNumber()) {
        double d = v.getAsDouble();
        if (d != Math.rint(d)) problem(f, "expected an integer", v);
        else if (d < min) problem(f, "expected at least " + min, v);
      }
    }

    void nullableInteger(JsonObject o, String f) {
      JsonElement v = o.get(f);
      if (v != null && v.isJsonNull()) return;
      integer(o, f, Integer.MIN_VALUE);
    }

    void object(JsonObject o, String f, BiConsumer<Check, JsonObject> inner) {
      JsonElement v = o.get(f);
      if (v == null || !v.isJsonObject()) problem(f, "expected an object", v);
      else inner.accept(at(f + "."), v.getAsJsonObject());
    }
  }
}
