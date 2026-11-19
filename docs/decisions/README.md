# Decisions

Short records of choices that shape the framework: the context, the decision, and what follows from it.
New decisions get the next number; a reversed decision is marked "Superseded" and links its replacement.

| # | Decision |
|---|---|
| [0001](0001-ci-runs-its-own-toolshop.md) | CI runs its own Toolshop instead of the public demo |
| [0002](0002-typescript-primary-java-twin.md) | TypeScript is primary, with a Java twin (scope widened to every scenario by 0009) |
| [0003](0003-accessibility-known-issues.md) | Accessibility: known issues per axe rule instead of exclusions |
| [0004](0004-visual-baselines-from-ci.md) | Visual baselines come from CI, on Chromium only |
| [0005](0005-api-contracts-with-zod.md) | Every API response is validated against a zod schema |
| [0006](0006-tag-registry-and-test-ids.md) | One tag registry, one tier and one test-plan ID per test |
| [0007](0007-throwaway-accounts-for-negative-logins.md) | Negative logins use throwaway accounts |
| [0008](0008-architecture-tests.md) | Architecture tests guard the pipeline against loops |
| [0009](0009-every-journey-in-both-languages.md) | Every scenario (A, U, S) ships in TypeScript and Java with the same tier; parity is checked |
| [0010](0010-known-defects-as-tests.md) | Known product defects are tracked as tests that pin today's exact behaviour |
| [0011](0011-retries-and-flaky-tests.md) | CI retries failed tests in both languages, and a test that passed only on a retry is reported as flaky, never hidden |
| [0012](0012-gherkin-features-with-layered-steps.md) | Scenarios are shared Gherkin features, run in both languages through steps → pages → modules |
