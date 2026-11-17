package com.showcase.annotations;

/**
 * Java twin of src/tags.ts: the only place tag names are spelled out.
 * Tests use the composed annotations in this package, never {@code @Tag("...")} directly,
 * and {@code TagGuardTest} fails the build if a test has no tier.
 */
public final class Tags {
  // Tier: every test has exactly one.
  public static final String SMOKE = "smoke";
  public static final String REGRESSION = "regression";

  // Kind: optional.
  public static final String NEGATIVE = "negative";
  public static final String E2E = "e2e";
  public static final String ADMIN = "admin";

  private Tags() {}
}
