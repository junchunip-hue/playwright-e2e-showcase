import { createCustomer } from '../data/customers';
import { Given } from '../fixtures';

// Steps layer: Gherkin sentences bound to page methods. Steps used by more than one feature live here.
// Java twin: java/src/test/java/com/showcase/steps/CommonSteps.java.

Given('a newly registered customer', async ({ api, ctx }) => {
  ctx.customer = await createCustomer(api);
});
