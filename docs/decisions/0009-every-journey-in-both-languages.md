# 0009 – Every journey ships in TypeScript and Java

**Status:** Accepted (amends [0002](0002-typescript-primary-java-twin.md))

**Context:** The showcase is meant to compare the same design in two stacks. Under 0002, Java only mirrored the
single-page smoke tests, so the journeys (the strongest part of the demo) existed in TypeScript only, and nothing
checked that the two suites covered the same scenarios.

**Decision:**
- Every journey (`S` IDs in [test-plan.md](../test-plan.md), including S1 = U6) and its API counterpart is implemented
  in both languages, with the same ID, the same steps and the same data.
- Java gets the same layers as TypeScript for journeys: a flow (`flows.CheckoutFlow`), page objects, data builders
  (`data.Customers`, `data.Payments`) and API resources.
- An architecture test fails when a journey ID or a test-plan row marked "Java ✅" exists in only one language.
- The PR pipeline ends with a summary job that shows both lanes side by side: a diagram of the run and a
  TypeScript-vs-Java table per test ID.

**Still TypeScript-only (unchanged from 0002):** accessibility, visual regression and architecture tests (they check
the product or the repository, not a scenario), and schema validation of every response.

**Consequences:** each new journey costs roughly twice the implementation time. In exchange, drift between the
two suites becomes a CI failure instead of a review comment, and the demo can show any journey in either language.
