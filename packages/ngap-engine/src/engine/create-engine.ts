import { defaultRuleset } from "../default-ruleset.js";
import { NgapConfigurationError } from "../errors.js";
import type { CodingContext, NgapEnvironment, Ruleset } from "../types.js";
import { evaluateWithRuleset } from "./evaluate.js";

export function assertProductionReady(ruleset: Ruleset): void {
  const unverifiedIds = [
    ...ruleset.rules,
    ...ruleset.catalog,
    ...ruleset.tariffs,
  ]
    .filter(({ active, status }) => active && status === "TO_VERIFY")
    .map(({ id }) => id);
  if (unverifiedIds.length > 0) {
    throw new NgapConfigurationError(unverifiedIds);
  }
}

export function createNgapEngine(options: {
  environment: NgapEnvironment;
  ruleset?: Ruleset;
}): { evaluate: (context: CodingContext) => ReturnType<typeof evaluateWithRuleset> } {
  const ruleset = options.ruleset ?? defaultRuleset;
  if (options.environment === "production") assertProductionReady(ruleset);
  return { evaluate: (context) => evaluateWithRuleset(context, ruleset) };
}
