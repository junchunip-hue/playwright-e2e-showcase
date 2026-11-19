/**
 * A value an earlier step must have put into `ctx`; fails with the step to add when it is missing, instead of a
 * TypeError deep inside a page method. Java twin: the accessors in steps/ScenarioContext.java.
 */
export function need<T>(value: T | undefined, missingStep: string): T {
  if (value === undefined) throw new Error(`Missing an earlier step: add "${missingStep}" before this one`);
  return value;
}
