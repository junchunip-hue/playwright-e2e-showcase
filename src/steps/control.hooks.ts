import { Before } from '../fixtures';

/**
 * The failure control (C IDs, tag @control, features/control): says at the top of its report entry that it fails on
 * purpose and is not counted, so nobody reads it as a real failure (test plan, "Control"; ADR 0013).
 */
Before({ tags: '@control' }, async ({ $testInfo }) => {
  $testInfo.annotations.push({
    type: 'failure control',
    description:
      'Fails on purpose every night to show how a failure is reported: the steps before the failing step passed, ' +
      'the failing step shows its error, and the steps after it are listed as skipped (not run). ' +
      'Not counted in the nightly verdict, the counts, the badge or the clean streak.',
  });
});
