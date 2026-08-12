import { defaultRuleset } from "./default-ruleset.js";
import { evaluateWithRuleset } from "./engine/evaluate.js";

export { defaultRuleset } from "./default-ruleset.js";
export { assertProductionReady, createNgapEngine } from "./engine/create-engine.js";
export { NgapConfigurationError, NgapInputError } from "./errors.js";
export * from "./types.js";

export function evaluate(context: Parameters<typeof evaluateWithRuleset>[0]) {
  return evaluateWithRuleset(context, defaultRuleset);
}
