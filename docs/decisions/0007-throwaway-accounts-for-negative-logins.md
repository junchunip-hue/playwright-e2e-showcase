# 0007 – Negative logins use throwaway accounts

**Status:** Accepted

**Context:** Toolshop locks an account (HTTP 423) after repeated failed logins. The wrong-password tests used the
shared demo customer, so repeated local runs locked it, which then broke `auth.setup.ts` and every logged-in test.

**Decision:** Tests that send a wrong password (UI and API, TypeScript and Java) first register a customer through the
API and fail the login against that account. The shared account is only used for successful logins.

**Consequences:**
- The suite can no longer lock the shared account. Other users of the public demo still can, so a local `setup`
  failure with 423 means "wait or use local Docker", not a product bug. CI is unaffected (fresh database per run).
- The same builder (`newCustomerData` / `createCustomer`, Java `Customers.create`) serves registration tests (A4, A5)
  and journeys.
