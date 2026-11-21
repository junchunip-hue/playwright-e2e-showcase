# Java twin (Cucumber-JVM on JUnit 5)

> Why there are two languages: [ADR 0002](decisions/0002-typescript-primary-java-twin.md). Since
> [ADR 0009](decisions/0009-every-journey-in-both-languages.md), **every scenario (A, U, S) ships in both, with the same tier**: in every pipeline the TypeScript and Java lanes run the same scenarios.

## Run
Needs JDK 21+. Maven comes from the wrapper, and config is read from the same `.env` as the TypeScript suite.
```bash
cd java
./mvnw exec:java -Dexec.args="install chromium"   # once: download the browser
./mvnw test -Dgroups=smoke                          # smoke scenarios (the PR gate)
./mvnw test                                         # everything (nightly)
```
On Windows use `mvnw.cmd`; set `HEADED=1` to watch the browser and `SLOW_MO=400` to slow it down. One scenario:
`-Dcucumber.filter.name="U6: .*"` (a regex for the whole scenario name; the Java side of `npm run demo`).

The failure control C1 (`features/control`, tag `@control`) fails on purpose, so every run leaves it out (`pom.xml`
`excludedGroups`). To see a failure reported step by step: `./mvnw test -Dgroups=control -DexcludedGroups=` (the build
then fails, as intended).

Every build formats the Java code first (Spotless with google-java-format, `./mvnw spotless:apply` on its own); in CI
the build only checks it and fails on an unformatted file ([coding rules](coding-rules.md#code-style)).

## Same layers, side by side
| Layer | TypeScript | Java |
|---|---|---|
| Features (shared Gherkin, ADR 0012) | `features/**/*.feature`, run by playwright-bdd | the same files, run by `RunCucumberTest` (Cucumber-JVM) |
| Steps (Gherkin bindings) | `src/steps/*.steps.ts`, `src/steps/api/` | `steps/*Steps.java`, `steps/api/` (+ `PlaywrightContext`, `ScenarioContext`, `Hooks`) |
| Pages (what a user does) | `src/pages/*.page.ts` | `pages/*Page.java` |
| Modules (locators only) | `src/modules/*.module.ts` | `modules/*Module.java` |
| Test data | `src/data/customers.ts`, `payments.ts`, `products.ts` | `data/Customers.java`, `Payments.java`, `Products.java` |
| API client (the page layer of API steps) | `src/api/` (per resource), steps in `src/steps/api/` | `api/ApiClient.java`, steps in `steps/api/` |
| Response contracts | `src/api/schemas.ts` (zod) | `api/Contracts.java` (same rules, same failure format) |
| Failed step and the steps not run (ADR 0013) | `src/steps/not-run.hooks.ts` + `src/fixtures/not-run.ts`: the steps after a failure are listed right after it, at the same level, as skipped; the test is annotated | Cucumber skips them; `report/ScenarioLog` keeps every step with its status and the failed step's error, which survives CI reruns |
| Tags and tiers | `src/tags.ts`; Gherkin tags become Playwright tags | the same Gherkin tags; Cucumber tags are JUnit tags (`-Dgroups=smoke`) |
| Data-driven tests | Scenario Outline / data table in the shared feature | the same feature |
| Tag/ID guard | `npm run check:tags` (covers the shared features for both languages) | – (same features, same tags) |

## What runs in both
In test-plan order (A, then U, then S, then the failure control C):

| ID | Scenario | TypeScript | Java |
|---|---|---|---|
| A0 | Response contracts (5 checks incl. the guard itself) | `features/api/contracts.feature` (shared) | `RunCucumberTest` + `steps/api/ProductsApiSteps`, `CustomersApiSteps` |
| A1–A3 | Products and auth API | `features/api/products.feature` (shared), `features/api/auth.feature` (shared) | `RunCucumberTest` + `steps/api/ProductsApiSteps`, `CustomersApiSteps` |
| A4, A5 | Registration rules (weak / leaked password, duplicate email) | `features/api/registration.feature` (shared) | `RunCucumberTest` + `steps/api/CustomersApiSteps` |
| A6 | Invoices need a signed-in user (no token, malformed token; routes as a data table) | `features/api/invoices.feature` (shared) | `RunCucumberTest` + `steps/api/InvoicesApiSteps` |
| A7 | Product filters: category, brand, price range, sort (Scenario Outline), combined | `features/api/product-filters.feature` (shared) | `RunCucumberTest` + `steps/api/ProductsApiSteps` |
| A8 | Admin publishes a product (own Toolshop only) | `features/api/admin.feature` (shared) | `RunCucumberTest` + `steps/api/ProductsApiSteps` |
| A9 | Payment check API | `features/api/payments.feature` (shared) | `RunCucumberTest` + `steps/api/PaymentsApiSteps` |
| U1, U2 | Login (valid / wrong password) | `features/ui/login.feature` (shared) | `RunCucumberTest` + `steps/LoginSteps` |
| U3, U4 | Search results match the term; UI agrees with the search API | `features/ui/search.feature` (shared) | `RunCucumberTest` + `steps/SearchSteps` |
| U5 | Add to cart updates the badge | `features/ui/cart.feature` (shared) | `RunCucumberTest` + `steps/CartSteps` |
| U6 (S1) | First purchase journey | `features/journeys/checkout.feature` (shared) | `RunCucumberTest` + `steps/CheckoutSteps` |
| S2 | Payment matrix journey (4 methods + 2 invalid cards, Scenario Outlines) | `features/journeys/checkout.feature` (shared) | `RunCucumberTest` + `steps/CheckoutSteps` |
| S3 | Admin publishes, customer buys, admin ships (own Toolshop only) | `features/journeys/admin-to-customer.feature` (shared) | `RunCucumberTest` + `steps/AdminSteps` |
| S4 | Guest checkout, order checked as admin (own Toolshop only) | `features/journeys/guest-checkout.feature` (shared) | `RunCucumberTest` + `steps/CheckoutSteps`, `AdminSteps` |
| S5 | Returning customer: favourite, comparison, invoice PDF download (own Toolshop only) | `features/journeys/shopper.feature` (shared) | `RunCucumberTest` + `steps/ShopperSteps` |
| S6 | Resilience: slow or failing catalogue and search, then recovery (`page.route` in the network page) | `features/journeys/resilience.feature` (shared) | `RunCucumberTest` + `steps/ResilienceSteps` |
| C1 | Failure control: fails on purpose at step 2 of 4, steps 3 and 4 not run; a separate nightly step, never counted | `features/control/failure-control.feature` (shared, project `api`) | `RunCucumberTest` + `steps/api/ProductsApiSteps`; only with `-Dgroups=control -DexcludedGroups=` |

TypeScript only, by design: accessibility (N2), visual (N1) and architecture (N3). They check rendering or the
repository, not a scenario.

## How the two stay in sync
- **Parity is a CI rule.** `tests/architecture/parity.arch.spec.ts` fails when an A/U/S/C ID exists in only one
  language, or when the test plan's "Java" column disagrees with the Java suite. Both languages run the same feature
  files, so an ID has the same tier in both by construction (both lanes of a pipeline run the same scenarios).
- **The pipeline shows both.** The summary job draws the run and lists every test ID with its TypeScript and Java
  results side by side (see [ci.md](ci.md#pipeline-summary)).
- **Same contract, same names.** Same `data-test` locators, env variables, test data and IDs. A locator change is
  the same one-line edit in both.
- **Same retries, same meaning of flaky.** CI reruns a failed test twice in both languages and never locally
  (`retries: isCI ? 2 : 0` in `playwright.config.ts`; Surefire's `rerunFailingTestsCount` in the `ci-retries` profile
  of `java/pom.xml`, switched on by the `CI` variable). A Java test that passes on a rerun is a flake: Surefire keeps
  the failed attempts as `<flakyFailure>` in the XML, and the summary lists it under Flaky tests like a TypeScript
  one. An architecture test keeps the two counts equal.
- **Same Playwright release line.** `playwright.version` in `java/pom.xml` follows the minor version of
  `@playwright/test` (Java patch releases can lag behind Node).

**Debugging a Java failure:** tests record a Playwright trace and keep it only on failure
(`target/playwright/`); CI uploads it as `junit-reports-traces` (PR) or `junit-reports-nightly-traces`, next to the
Surefire XML, also when the test passed on a rerun (the trace is the failed attempt's). Open it with `npx playwright show-trace <file>.zip`.

**Known difference:** TypeScript logs in once for single-page tests (`setup` project + `storageState`); Java signs in
inside the test. Journeys use fresh customers in both.
