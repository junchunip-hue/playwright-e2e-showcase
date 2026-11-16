# Playwright E2E Showcase

[![PR Smoke Tests](https://github.com/junchunip-hue/playwright-e2e-showcase/actions/workflows/pr-smoke.yml/badge.svg)](https://github.com/junchunip-hue/playwright-e2e-showcase/actions/workflows/pr-smoke.yml)
[![Nightly Regression](https://github.com/junchunip-hue/playwright-e2e-showcase/actions/workflows/nightly-regression.yml/badge.svg)](https://github.com/junchunip-hue/playwright-e2e-showcase/actions/workflows/nightly-regression.yml)
· [Latest regression report](https://junchunip-hue.github.io/playwright-e2e-showcase/)

A production-style test automation framework built with **Playwright + TypeScript**, targeting the public
[Practice Software Testing (Toolshop)](https://practicesoftwaretesting.com) demo shop.

The goal is to show how I would set up E2E testing in a real team: risk-based scope, API + UI layering,
stable locators, isolated test data and CI integration, not just a collection of scripts.

## Highlights
- **Page Objects + custom fixtures**: tests receive page objects and an API client through dependency injection
- **API + UI hybrid tests**: the backend is the source of truth for UI assertions
- **Authenticated session reuse** with a `setup` project and `storageState`
- **Tag-based suites**: `@smoke`, `@regression`, `@negative`
- **CI on every PR** (GitHub Actions): lint, typecheck, smoke tests, HTML report artifact
- **Nightly regression**: full suite on Chromium, Firefox and WebKit, sharded across 3 jobs, merged into one
  HTML report published to GitHub Pages; full Java suite runs alongside
- **Isolated CI environment**: CI boots Toolshop in Docker (pinned upstream commit, freshly seeded DB) instead of
  depending on the shared public demo
- **Checkout E2E**: customer registered via API, purchase through the UI, invoice verified via API
- **Documented test strategy and plan**: [`docs/test-strategy.md`](docs/test-strategy.md) (why) and
  [`docs/test-plan.md`](docs/test-plan.md) (what, where, in which order)
- **Java + JUnit 5 twin suite** ([`java/`](java/)): the core smoke scenarios ported to Playwright for Java, run as a
  parallel CI job against the same pinned Toolshop
- **AI-assisted test authoring**: Playwright Test Agents (planner, generator, healer) wired to Claude Code via
  [`.mcp.json`](.mcp.json)

## Project structure
```
src/
  api/          typed REST client (Toolshop API)
  config/       environment handling
  data/         test data builders (API-created customers)
  fixtures/     custom Playwright fixtures
  pages/        page & component objects
tests/
  auth.setup.ts login once, save session
  ui/           browser tests
  api/          API tests
java/           Playwright for Java + JUnit 5 (core scenarios, same layout: api/ config/ pages/ tests/)
.github/
  actions/      shared Toolshop boot (used by both CI jobs)
  workflows/    PR smoke (TypeScript + Java) and nightly regression (sharded, all browsers)
```

## Getting started
```bash
npm install
npx playwright install
cp .env.example .env
npm run test:smoke      # quick check
npm test                # everything
npm run report          # open the HTML report
```

### Java suite
Needs JDK 21+. Maven comes from the wrapper; config is read from the same `.env` as the TypeScript suite.
```bash
cd java
./mvnw exec:java -Dexec.args="install chromium"   # once: download the browser
./mvnw test -Dgroups=smoke                          # smoke scenarios
./mvnw test                                         # everything
```
On Windows use `mvnw.cmd`; set `HEADED=1` to watch the browser.

## Two languages, one suite
TypeScript is the primary suite; Java holds a deliberately small subset of the same scenarios.

| Scenario | TypeScript | Java |
|---|---|---|
| Login (valid / wrong password) | `tests/ui/login.spec.ts` | `LoginTest` |
| Search results match term | `tests/ui/search.spec.ts` | `SearchTest` |
| Add to cart updates badge | `tests/ui/cart.spec.ts` | `CartTest` |
| Products / auth API | `tests/api/products.api.spec.ts` | `ApiTest` |
| Checkout E2E, UI-vs-API search | ✅ | TypeScript only |

How the two stay in sync:
- **Same contract, same names.** Both use the `data-test` locators, the same env variables and defaults, and mirrored
  page objects and API client (`HomePage.ts` ↔ `HomePage.java`). A locator change is the same one-line edit in both.
- **Same tags.** `@smoke` / `@negative` in TypeScript are `@Tag("smoke")` / `@Tag("negative")` in JUnit.
- **Same Playwright version.** `playwright.version` in `java/pom.xml` follows `@playwright/test` in `package.json`.
- **CI enforces it.** Every PR runs both jobs against the same pinned Toolshop, so a UI change that breaks one
  language and not the other shows up immediately.
- **New scenarios start in TypeScript.** Only port a scenario to Java when it becomes part of the smoke set.

## Roadmap
- [x] Checkout E2E with API-created test user
- [x] Run the app in Docker in CI for full data control
- [x] Java + JUnit 5 twin suite for the smoke scenarios
- [x] Nightly regression with sharding + merged report published to GitHub Pages
- [ ] Visual regression and accessibility (axe-core) checks
