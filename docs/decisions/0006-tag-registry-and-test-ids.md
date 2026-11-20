# 0006 – One tag registry, one tier and one test-plan ID per test

**Status:** Accepted. Since [0012](0012-gherkin-features-with-layered-steps.md) both languages run the same Gherkin
features, so tiers and IDs live in the feature files and `npm run check:tags` checks them for both; the Java
`TagGuardTest` and composed annotations below were removed with the last JUnit test class (historical).

**Context:** Tags decide which tests gate a PR. They were string literals spread over specs, config, npm scripts and
workflows, so a typo silently dropped a test from the gate, and every grep had to remember `@setup`. The test plan
listed IDs that nothing linked to the code.

**Decision:**
- `src/tags.ts` defines every tag and suite; specs use `Tag.*`, and CI selects suites by name (`SUITE=pr`).
- Every test has exactly one tier (`@smoke`, `@regression`, `@setup`, `@seed`) and, except setup/seed, a title that
  starts with its test-plan ID (`U6: ...`).
- `npm run check:tags` and the Java `TagGuardTest` enforce both. Java uses composed annotations (`@SmokeTest`,
  `@RegressionTest`, `@Negative`, `@ToolshopTest`) instead of raw `@Test` / `@Tag`.

**Consequences:**
- Changing what a suite runs means editing `src/tags.ts` or a test's tier, a visible review point.
- On its first run the guard found one test without a tier (API "wrong password → 401"); it was made explicitly
  `@regression`, keeping its schedule.
