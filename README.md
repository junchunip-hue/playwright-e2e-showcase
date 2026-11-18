# Playwright E2E Showcase

[![PR Smoke Tests](https://github.com/junchunip-hue/playwright-e2e-showcase/actions/workflows/pr-smoke.yml/badge.svg)](https://github.com/junchunip-hue/playwright-e2e-showcase/actions/workflows/pr-smoke.yml)
[![Nightly Regression](https://github.com/junchunip-hue/playwright-e2e-showcase/actions/workflows/nightly-regression.yml/badge.svg)](https://github.com/junchunip-hue/playwright-e2e-showcase/actions/workflows/nightly-regression.yml)
· [Latest regression report](https://junchunip-hue.github.io/playwright-e2e-showcase/)

A test automation framework built the way I would set it up in a real team, with **Playwright + TypeScript**
(and a Java + JUnit 5 twin). It targets the open-source [Toolshop](https://practicesoftwaretesting.com) demo shop.

## The 3-minute tour

**1. A journey that reads like the story it tests:** [`tests/e2e/checkout.spec.ts`](tests/e2e/checkout.spec.ts)
```ts
const customer = await createCustomer(api);              // arrange via API: fresh data, no shared state
const product = await api.products.findInStock();

await checkout.addToCart(product);                       // act via UI: business steps from src/flows
const cartTotal = await checkout.reviewCart([product]);
await checkout.signIn(customer);
await checkout.confirmAddress(customer.address);
const invoiceNumber = await checkout.pay(payments.cashOnDelivery());
// assert via API: the invoice exists, for this customer, at the cart total
```

**2. Quality beyond "it works"**
- Every API response is checked against a schema ([`src/api/schemas.ts`](src/api/schemas.ts)).
- Accessibility (axe, WCAG 2.1 AA) and visual regression run in [`tests/quality/`](tests/quality/).
- The full suite runs nightly on Chromium, Firefox and WebKit.

**3. A pipeline that guards itself**
- Tags and suites live in one registry ([`src/tags.ts`](src/tags.ts)), and every test title carries its test-plan ID.
- [Architecture tests](tests/architecture/) fail if a workflow could trigger itself, a dependency loops, or a job could hang.

## How it runs

```mermaid
flowchart LR
  subgraph PR["Every pull request: two lanes in parallel, each with its own Toolshop"]
    direction LR
    S["Static: lint · types ·<br/>tag check · architecture + parity"] --> TS["TypeScript: API + Chromium<br/>smoke · a11y · visual"]
    J["Java: JUnit 5 smoke<br/>(same scenario IDs)"]
    TS --> SUM["Summary: run diagram +<br/>TS vs Java per test ID"]
    J --> SUM
  end
  subgraph N["Nightly 02:00 UTC"]
    direction LR
    SH["TypeScript: 3 shards ×<br/>Chromium, Firefox, WebKit"] --> M["Merged HTML report"] --> P["GitHub Pages"]
    NJ["Java: full suite,<br/>all journeys"] --> NS["Summary"]
    M --> NS
  end
  L["PR label<br/>update-snapshots"] --> B["Regenerate visual baselines<br/>and commit to the PR"]
```

| Layer | IDs | What it proves | Languages |
|---|---|---|---|
| API | A0–A5, A8–A11 | Contracts, auth, registration rules, payment check, admin publishing; customer-vs-admin permissions as tracked known defects | TS + Java |
| UI | U1–U5 | Login, search (incl. UI = API), cart | TS + Java |
| Journeys | U6/S1, S2, S3, S4, S6 | First purchase, every payment method, admin → customer → admin, guest checkout, slow or failing backend (network mocking) | TS + Java |
| Quality | N1, N2 | Visual regression, accessibility (WCAG 2.1 AA) | TS |
| Architecture | N3 | Pipeline cannot loop, TS/Java parity | TS |

Full inventory, with where each ID runs: [docs/test-plan.md](docs/test-plan.md#3-test-inventory).

CI never uses the public demo: it boots its own Toolshop for every run, so results depend only on the code
([why](docs/ci.md#system-under-test)).

## Layout

```
src/
  api/          API client per resource + zod schemas (types derived from them)
  flows/        business steps for journeys (checkout, ...)
  pages/        page & component objects (locators only)
  data/         test data builders (fresh customers per test)
  fixtures/     everything above, injected into tests
  tags.ts       tag and suite registry
  a11y/ visual/ reporters/ config/
tests/
  api/          contract, auth and registration tests
  ui/           single-page behaviour (login, search, cart)
  e2e/          journeys across pages, API and UI
  quality/      accessibility and visual regression
  architecture/ rules about the pipeline and the code itself
java/           Playwright for Java + JUnit 5: every A/U/S scenario, same IDs and tiers
.github/        workflows (PR, nightly, baselines) and shared actions
```

## Run it

```bash
npm install && npx playwright install && cp .env.example .env
npm run test:pr             # what the PR gate runs (API + Chromium)
npm run test:architecture   # pipeline/code rules, no browser
npm run check:tags          # tag counts; fails on unknown tags, missing tier or ID
npm test                    # everything
npm run report              # open the HTML report
```
Java: `cd java && ./mvnw test` (JDK 21+, see [docs/java.md](docs/java.md)). Every scenario exists in both languages,
and each CI run ends with a summary that draws the run and compares TypeScript and Java per test ID.

## Read more

| Question | Document |
|---|---|
| Why is it built this way? | [docs/test-strategy.md](docs/test-strategy.md) |
| What runs, where, and which IDs exist? | [docs/test-plan.md](docs/test-plan.md) |
| How does the pipeline work and protect itself? | [docs/ci.md](docs/ci.md) |
| Which decisions were made, and why? | [docs/decisions/](docs/decisions/) |
| Where do I see the latest results? | [Nightly report](https://junchunip-hue.github.io/playwright-e2e-showcase/) (3 browsers) · each run's summary in [Actions](https://github.com/junchunip-hue/playwright-e2e-showcase/actions): run diagram + TS vs Java per ID ([how](docs/ci.md#pipeline-summary)) |
| What comes next? | [docs/roadmap.md](docs/roadmap.md) |
| How do the TypeScript and Java lanes stay in sync? | [docs/java.md](docs/java.md) |
