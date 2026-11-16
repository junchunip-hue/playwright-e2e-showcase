# Java + JUnit 5 twin

> Why there are two languages: [ADR 0002](decisions/0002-typescript-primary-java-twin.md).

## Run
Needs JDK 21+. Maven comes from the wrapper, and config is read from the same `.env` as the TypeScript suite.
```bash
cd java
./mvnw exec:java -Dexec.args="install chromium"   # once: download the browser
./mvnw test -Dgroups=smoke                          # smoke scenarios (the PR gate)
./mvnw test                                         # everything (nightly)
```
On Windows use `mvnw.cmd`; set `HEADED=1` to watch the browser.

## What is mirrored
| ID | Scenario | TypeScript | Java |
|---|---|---|---|
| U1, U2 | Login (valid / wrong password) | `tests/ui/login.spec.ts` | `LoginTest` |
| U3 | Search results match the term | `tests/ui/search.spec.ts` | `SearchTest` |
| U5 | Add to cart updates the badge | `tests/ui/cart.spec.ts` | `CartTest` |
| A1–A3 | Products and auth API | `tests/api/products.api.spec.ts` | `ApiTest` |
| U6 and the rest | Checkout journey, contracts, a11y, visual, architecture | ✅ | TypeScript only |

## How the two stay in sync
- **Same contract, same names.** Both use the `data-test` locators, the same env variables and defaults, and mirrored
  page objects (`HomePage.ts` ↔ `HomePage.java`). A locator change is the same one-line edit in both.
- **Same tags and IDs.** `Tag.smoke` / `Tag.negative` are `@SmokeTest` / `@Negative` in JUnit, and display names carry
  the same test-plan IDs. `TagGuardTest` enforces one tier and a known ID per test.
- **Same Playwright release line.** `playwright.version` in `java/pom.xml` follows the minor version of
  `@playwright/test` (Java patch releases can lag behind Node).
- **CI enforces it.** Every PR runs both against the same pinned Toolshop.
- **New scenarios start in TypeScript.** A scenario is ported only when it joins the smoke set (roadmap: S1, S2).

**Known difference:** TypeScript logs in once (`setup` project + `storageState`). Java `CartTest` signs in inside the
test, which keeps the module free of cross-test state at the cost of a few seconds.
