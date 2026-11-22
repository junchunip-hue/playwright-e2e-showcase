# 0014 – Every PR shows which scenarios it can affect, and whether it can break the structure

**Status:** Accepted

**Context:** With several people changing shared steps, pages and modules, a PR's own smoke run does not say what
else the change touches. A step sentence, a page method or a module locator is shared by scenarios that other people
own, and most of them (`@regression`) run only in the nightly, after the merge. Finding out afterwards why a nightly
failed means tracing the cause back through commits, environments and infrastructure that the person looking may not
know. That gets harder as the suite and the team grow.

**Options considered:**
- After the fact: classify nightly failures (code, environment, flaky) and bisect them to a commit. It needs the
  background of every system involved and still comes after the merge.
- Run every scenario on every PR. Slow, needs every browser, and still does not tell the reviewer what is at risk.
- Before the merge: derive from the change itself which scenarios and which of their steps it can affect, and check
  the framework's structure, and show both in the PR where the author and the reviewers already are.

**Decision:** The third. `.github/workflows/pr-impact.yml` runs on every PR push, next to the smoke tests, and keeps
two comments up to date:
1. **Scenario impact** (`scripts/pr-impact.mjs`): every feature scenario the change can affect, with the steps in it,
   the language (TypeScript, Java or both), its tier and whether this PR's smoke runs it. Each step says why: the
   chain from the changed code to the step definition (`CheckoutModule.finish → CheckoutPage.pay`). The analysis
   follows the layers that the architecture tests enforce: a changed line → its code unit → every unit that uses it
   (with types where the code states them: `checkoutPage.pay()` reaches `CheckoutPage.pay`, not `LoginPage.pay`) → the
   step definitions → every scenario step their sentence matches. A changed feature line marks its scenario; a file
   every run depends on (config, Hooks.java, the failure reporting) marks every scenario of its language; a reworded
   step that no definition matches any more is a warning. Comment and import lines change nothing and are left out.
2. **Structure check** (`scripts/pr-structure.mjs`): the architecture rules, TypeScript types, Java compile, the Java
   dry run, tags and IDs, the step catalogue, each with its first error; dependency cycles and
   dependencies against the layers in the whole repository, both languages, new files and folders included, each
   marked new in this PR or already on the base branch; and every dependency the PR adds. How many files a change
   reaches is not counted: the first comment already names the scenarios and steps it affects. A cycle also fails an
   architecture rule (TypeScript imports and Java class references), so it cannot be merged in either language.

Both are static: no Toolshop, no browser, a few minutes. They inform; the smoke workflow's checks still gate the merge.

**Consequences:**
- A reviewer sees, before merging, the other people's scenarios a change can break, and the `--grep` to run the
  nightly-only ones on the branch.
- The analysis reads names and declared types, not a compiler's call graph: when a receiver's type is unknown it
  counts the member on every class the file can reach, so it may list a scenario too many, not too few. Code reached
  only by reflection or dynamic names would be missed; the suite has none.
- The analysis relies on the layer rules (steps → pages → modules, fixtures by name). The architecture tests that
  keep those rules are what keep the analysis accurate.
