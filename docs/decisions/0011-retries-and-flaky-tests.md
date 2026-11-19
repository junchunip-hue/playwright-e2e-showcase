# 0011 – Retries in CI, and flaky tests are reported, never hidden

**Status:** Accepted

**Context:** Every run starts its own Toolshop and installs browsers on shared runners, and the journeys race the
app's own asynchronous work (postcode lookups, the saved address being filled in, invoice PDFs written by a
background job). Some failures are one-off. Without retries, one bad moment turns a whole nightly red; with retries
alone, a test that fails every third run looks green for ever. On 2026-11-19 both happened in one day: S2 failed once
on Firefox and passed on the retry (a test race), and the summary still showed a plain green run. TypeScript retried
and Java did not, so the two languages also meant different things by "passed".

**Options considered:**
- No retries: honest, but shared infrastructure (mirrors, artifact storage) would fail runs that found nothing.
- Retries, results as Playwright reports them: the flake is only a count in the HTML report's Flaky tab, and the
  run, its badge and its commit status are green.
- **Retries, and a separate verdict for "passed with flaky"** (chosen).

**Decision:**
- CI retries a failed test twice in both languages (`retries: isCI ? 2 : 0` in `playwright.config.ts`; Surefire's
  `rerunFailingTestsCount` in the `ci-retries` profile of `java/pom.xml`, switched on by the `CI` variable). Local runs
  never retry.
- The pipeline summary gives one verdict: ✅ passed, ⚠️ passed with flaky, ❌ failed. Flaky tests are listed by ID,
  browser and file with their attempts and first error, and get a warning annotation. The verdict is posted as a
  commit status (`test verdict / …`) and coloured into the README badge.
- A failed lane (e.g. a shard that could not install its browsers) is ❌, even when no test failed.

**Consequences:**
- A flake costs no red run but cannot pass unnoticed: it reopens the stability criterion (roadmap §5) until fixed.
- The fix for a flake is its cause, never more retries; an architecture test keeps the retry count equal in both
  languages and the Java reruns CI-only.
- Traces of failed attempts are kept for flaky tests too (TypeScript: HTML report; Java: the traces artifact, uploaded
  whenever an attempt failed).
