# 0002 – TypeScript is primary, with a Java twin (originally smoke scenarios only)

**Status:** Accepted, amended by [0009](0009-every-journey-in-both-languages.md): every scenario (A, U, S) now ships
in both languages with the same tier, and Java checks every response against `api.Contracts`. The "smoke only" scope
and the "no schema validation" consequence below are historical.

**Context:** Playwright Test (fixtures, projects, retries, sharding, HTML report, trace) and newer tooling such as
Test Agents exist only for Node. Many teams, however, run Java stacks (JUnit/TestNG, Maven).

**Decision:** TypeScript holds the full suite. A Java + JUnit 5 module (`java/`) mirrors the smoke scenarios with the
same locators, env variables, tags and test-plan IDs. New coverage lands in TypeScript; a scenario is ported to Java
only when it joins the smoke set.

**Consequences:**
- The same scenarios in two runners show the design is not tied to one language.
- Locator changes are mechanical edits in both; CI runs both on every PR, so drift shows up immediately.
- Java reuses no Playwright Test features: it signs in inside tests instead of sharing a saved session, and it
  parses only the API fields its scenarios need (no schema validation).
