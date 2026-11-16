# 0008 – Architecture tests guard the pipeline against loops

**Status:** Accepted

**Context:** The pipeline has automation that writes back (the baseline workflow commits to PR branches) and shared
building blocks (composite actions, suites, page objects). Such setups can loop or recurse without anyone noticing
until a run hangs or repeats.

**Decision:** `tests/architecture/` checks the rules statically, in the PR static stage, in about a second
(rules listed in [ci.md](../ci.md#architecture-tests)): no self-triggering workflow, no `workflow_run` or dispatch
recursion, no cycles in actions, npm scripts, projects or imports, every job bounded, no unbounded shell loops.

**Consequences:**
- On its first run the timeout rule found two nightly jobs without a timeout (GitHub's default is 6 hours); both are
  now bounded.
- Injecting a push trigger, a `while true`, an import cycle and an npm-script cycle made the matching rules fail with
  the exact path or cycle.
- The rules read YAML and source files only; they never run a workflow.
