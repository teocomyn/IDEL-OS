import catalogData from "../rules-data/catalog.json" with { type: "json" };
import rulesData from "../rules-data/rules.json" with { type: "json" };
import tariffsData from "../rules-data/tariffs.json" with { type: "json" };

import { rulesetSchema } from "./types.js";

export const defaultRuleset = rulesetSchema.parse({
  version: "2026-08-12",
  catalog: catalogData,
  tariffs: tariffsData,
  rules: rulesData,
});
