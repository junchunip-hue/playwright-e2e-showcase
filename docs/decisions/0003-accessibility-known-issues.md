# 0003 – Accessibility: known issues per axe rule instead of exclusions

**Status:** Accepted

**Context:** axe-core scans (WCAG 2.1 A/AA) of six pages found existing violations in Toolshop, a third-party app
that cannot be fixed here. Failing every run would hide new problems; `exclude(selector)` would silence *every* rule
on an element.

**Decision:** Known violations are listed per axe rule, with where they occur, in `src/a11y/accessibility.ts`. A
violation of any other rule fails the test. A listed rule that stops occurring is reported as an annotation, so
the list only shrinks. Scans run on Chromium only, because axe evaluates the DOM, not the rendering engine.

| Rule | Where | Impact |
|---|---|---|
| `label-content-name-mismatch` | Header (all pages): language selector, cart link | serious |
| `list` | Catalogue: category filter `<ul>` contains non-`<li>` children | serious |
| `button-name` | Login: password visibility toggle has no accessible name | critical |

**Consequences:** new violations fail the PR gate. Automated scans catch only part of real issues (no keyboard flow,
focus order or screen-reader output); they complement manual checks rather than replace them.
