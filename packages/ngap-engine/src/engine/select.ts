import type { CatalogAct, Rule, Ruleset, Tariff } from "../types.js";

export function isApplicable(
  entry: { active: boolean; validFrom: string; validUntil: string | null },
  date: Date,
): boolean {
  const day = date.toISOString().slice(0, 10);
  return entry.active && entry.validFrom <= day && (entry.validUntil === null || day <= entry.validUntil);
}

export function selectCatalogAct(
  ruleset: Ruleset,
  catalogId: string,
  date: Date,
): CatalogAct | undefined {
  return ruleset.catalog.find((entry) => entry.id === catalogId && isApplicable(entry, date));
}

export function selectTariff(ruleset: Ruleset, code: string, date: Date): Tariff | undefined {
  return ruleset.tariffs.find((entry) => entry.code === code && isApplicable(entry, date));
}

export function selectRule<T extends Rule["type"]>(
  ruleset: Ruleset,
  type: T,
  date: Date,
): Extract<Rule, { type: T }> | undefined {
  return ruleset.rules.find(
    (entry): entry is Extract<Rule, { type: T }> => entry.type === type && isApplicable(entry, date),
  );
}
