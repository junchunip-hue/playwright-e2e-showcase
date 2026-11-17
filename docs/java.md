# Java + JUnit 5 twin

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
On Windows use `mvnw.cmd`; set `HEADED=1` to watch the browser.

## Same layers, side by side
| Layer | TypeScript | Java |
|---|---|---|
| Journey steps | `src/flows/CheckoutFlow.ts` | `flows/CheckoutFlow.java` |
| Page objects | `src/pages/*.ts` | `pages/*.java` |
| Test data | `src/data/customers.ts`, `payments.ts` | `data/Customers.java`, `Payments.java` |
| API client | `src/api/` (per resource) | `api/ApiClient.java` |
| Response contracts | `src/api/schemas.ts` (zod) | `api/Contracts.java` (same rules, same failure format) |
| Tags and tiers | `src/tags.ts`, `Tag.smoke` | `annotations/`, `@SmokeTest`, `@RegressionCases`, `@Journey` |
| Data-driven tests | `for (const payment of methods) test(...)` | `@RegressionCases` + `@MethodSource` (one case per argument) |
| Tag/ID guard | `npm run check:tags` | `TagGuardTest` |

## What runs in both
| ID | Scenario | TypeScript | Java |
|---|---|---|---|
| U6 (S1) | First purchase journey | `tests/e2e/checkout.spec.ts` | `CheckoutJourneyTest` |
| S2 | Payment matrix journey (4 methods + 2 invalid cards) | `tests/e2e/payments.spec.ts` | `PaymentJourneyTest` |
| A9 | Payment check API | `tests/api/payments.api.spec.ts` | `PaymentApiTest` |
| U1, U2 | Login (valid / wrong password) | `tests/ui/login.spec.ts` | `LoginTest` |
| U3, U4 | Search results match the term; UI agrees with the search API | `tests/ui/search.spec.ts` | `SearchTest` |
| U5 | Add to cart updates the badge | `tests/ui/cart.spec.ts` | `CartTest` |
| A1–A3 | Products and auth API | `tests/api/products.api.spec.ts` | `ApiTest` |
| A0 | Response contracts (5 checks incl. the guard itself) | `tests/api/contracts.api.spec.ts` | `ContractsApiTest` |
| A4, A5 | Registration rules (weak / leaked password, duplicate email) | `tests/api/registration.api.spec.ts` | `RegistrationApiTest` |

TypeScript only, by design: accessibility (N2), visual (N1) and architecture (N3). They check rendering or the
repository, not a scenario.

## How the two stay in sync
- **Parity is a CI rule.** `tests/architecture/parity.arch.spec.ts` fails when an A/U/S ID exists in only one
  language, or when the test plan's "Java" column disagrees with the Java suite; `check:tags` fails when an ID's tier
  differs between the languages (so both lanes of a pipeline run the same scenarios).
- **The pipeline shows both.** The summary job draws the run and lists every test ID with its TypeScript and Java
  results side by side (see [ci.md](ci.md#pipeline-summary)).
- **Same contract, same names.** Same `data-test` locators, env variables, test data and IDs. A locator change is
  the same one-line edit in both.
- **Same Playwright release line.** `playwright.version` in `java/pom.xml` follows the minor version of
  `@playwright/test` (Java patch releases can lag behind Node).

**Known difference:** TypeScript logs in once for single-page tests (`setup` project + `storageState`); Java signs in
inside the test. Journeys use fresh customers in both.
