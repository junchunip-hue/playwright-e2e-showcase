# 0009 – Every scenario ships in TypeScript and Java

**Status:** Accepted (amends [0002](0002-typescript-primary-java-twin.md)); scope extended from journeys to all
scenario tests

**Context:** The showcase is meant to compare the same design in two stacks. Under 0002, Java only mirrored the
single-page smoke tests, so the journeys (the strongest part of the demo), the contract checks and the
registration rules existed in TypeScript only, and nothing checked that the two suites covered the same scenarios.

**Decision:**
- **Every scenario test runs in both languages:** API (`A`), UI (`U`) and journeys (`S`) from
  [test-plan.md](../test-plan.md), with the same ID, the same steps, the same data and **the same tier**. So in
  every pipeline the TypeScript and Java lanes run the same scenarios.
- **Java gets the same layers as TypeScript:**
  - a flow (`flows.CheckoutFlow`) and page objects
  - data builders (`data.Customers`, `data.Payments`, `data.Products`)
  - an API client that checks every response against **`api.Contracts`**, a rule-for-rule twin of the zod schemas in
    `src/api/schemas.ts`
- **CI enforces it.** The parity architecture test fails when an A/U/S ID exists in only one language, or when the
  test plan's Java column is wrong. `check:tags` fails when an ID's tier differs between the languages.
- **The pipelines show it.** PR and nightly end with a summary job: a diagram of the run and a TypeScript-vs-Java
  table per test ID.

**TypeScript-only (`N` IDs):** accessibility, visual regression and architecture tests. They check the product's
rendering or the repository itself, not a scenario, and running them twice would add no information.

**Consequences:**
- Each new scenario costs roughly twice the implementation time.
- In exchange, drift between the two suites becomes a CI failure instead of a review comment, and the demo can show any scenario in either
  language. The contract rules exist twice (zod and `Contracts.java`). A0's guard test in both languages proves
  each implementation reports a retyped field.
