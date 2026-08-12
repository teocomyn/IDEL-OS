import { NgapInputError } from "../errors.js";
import type {
  Alert,
  CatalogAct,
  CodingContext,
  CodingLine,
  CodingResult,
  Rule,
  RuleRef,
  Ruleset,
  Tariff,
} from "../types.js";
import { codingContextSchema } from "../types.js";
import { selectCatalogAct, selectRule, selectTariff } from "./select.js";

type WorkingAct = {
  inputIndex: number;
  catalog: CatalogAct;
  tariff: Tariff;
  tags: string[];
  quantity: number;
  baseAmountCents: number;
  rate: number;
  ruleIds: string[];
};

function toRuleRef(rule: Rule): RuleRef {
  return {
    id: rule.id,
    version: rule.version,
    title: rule.title,
    status: rule.status,
    source: rule.source,
  };
}

function addAppliedRule(target: Map<string, RuleRef>, rule: Rule | undefined): void {
  if (rule !== undefined) {
    target.set(rule.id, toRuleRef(rule));
  }
}

function createFixedLine(
  id: string,
  kind: "majoration" | "travel",
  tariff: Tariff,
  rule: Rule,
  quantity = 1,
): CodingLine {
  const amountCents = Math.round(tariff.amountCents * quantity);
  return {
    id,
    kind,
    catalogId: null,
    label: tariff.label,
    code: tariff.code,
    coefficient: null,
    quantity,
    baseAmountCents: amountCents,
    appliedRate: 1,
    amountCents,
    appliedRuleIds: [rule.id],
  };
}

function resolveActs(
  context: CodingContext,
  ruleset: Ruleset,
  alerts: Alert[],
): WorkingAct[] {
  const acts: WorkingAct[] = [];
  context.acts.forEach((input, inputIndex) => {
    const catalog = selectCatalogAct(ruleset, input.catalogId, context.date);
    if (catalog === undefined) {
      const knownId = ruleset.catalog.some(({ id }) => id === input.catalogId);
      alerts.push({
        severity: "blocking",
        code: knownId ? "NO_CATALOG_VERSION" : "UNKNOWN_CATALOG_ACT",
        message: knownId
          ? "Aucune version du catalogue n'est applicable à la date du soin."
          : "Cet acte n'existe pas dans le catalogue NGAP chargé.",
        ruleId: null,
      });
      return;
    }
    const tariff = selectTariff(ruleset, catalog.letterKey, context.date);
    if (tariff === undefined) {
      alerts.push({
        severity: "blocking",
        code: "NO_TARIFF_VERSION",
        message: `Aucun tarif ${catalog.letterKey} n'est applicable à la date du soin.`,
        ruleId: null,
      });
      return;
    }
    const quantity =
      catalog.maxQuantityPerVisit === null
        ? input.quantity
        : Math.min(input.quantity, catalog.maxQuantityPerVisit);
    if (quantity !== input.quantity) {
      alerts.push({
        severity: "warning",
        code: "QUANTITY_CAPPED_PER_VISIT",
        message: "Cet acte est facturable une seule fois par passage.",
        ruleId: "medication-once-per-visit",
      });
    }
    acts.push({
      inputIndex,
      catalog,
      tariff,
      tags: [...catalog.tags, ...input.tags],
      quantity,
      baseAmountCents: Math.round(tariff.amountCents * catalog.coefficient * quantity),
      rate: 1,
      ruleIds: [],
    });
  });
  return acts.sort(
    (left, right) => right.baseAmountCents - left.baseAmountCents || left.inputIndex - right.inputIndex,
  );
}

function applyCumul(
  acts: WorkingAct[],
  context: CodingContext,
  ruleset: Ruleset,
  alerts: Alert[],
  appliedRules: Map<string, RuleRef>,
): void {
  const cumulRule = selectRule(ruleset, "cumul", context.date);
  if (cumulRule === undefined || acts.length < 2) return;

  let standardIndex = 0;
  for (const act of acts) {
    if (act.tags.includes(cumulRule.fullRateTag)) {
      act.rate = 1;
      act.ruleIds.push(cumulRule.id);
      continue;
    }
    act.rate = cumulRule.rates[standardIndex] ?? cumulRule.defaultRate;
    act.ruleIds.push(cumulRule.id);
    standardIndex += 1;
  }
  addAppliedRule(appliedRules, cumulRule);

  const exclusiveRule = selectRule(ruleset, "exclusive_tag", context.date);
  if (exclusiveRule === undefined) return;
  const exclusiveActs = acts.filter(({ tags }) => tags.includes(exclusiveRule.tag));
  if (exclusiveActs.length < 2) return;

  exclusiveActs.slice(1).forEach((act) => {
    act.rate = 0;
    act.ruleIds.push(exclusiveRule.id);
  });
  alerts.push({
    severity: "warning",
    code: exclusiveRule.alertCode,
    message: exclusiveRule.explanation,
    ruleId: exclusiveRule.id,
  });
  addAppliedRule(appliedRules, exclusiveRule);
}

function addTravel(
  lines: CodingLine[],
  context: CodingContext,
  ruleset: Ruleset,
  alerts: Alert[],
  appliedRules: Map<string, RuleRef>,
): void {
  if (!context.visit.isHomeVisit) return;
  const rule = selectRule(ruleset, "travel", context.date);
  if (rule === undefined) return;
  const ifd = selectTariff(ruleset, rule.ifdTariffCode, context.date);
  if (ifd === undefined) {
    alerts.push({ severity: "blocking", code: "NO_IFD_TARIFF", message: "Tarif IFD absent.", ruleId: rule.id });
    return;
  }
  lines.push(createFixedLine("travel-ifd", "travel", ifd, rule));
  const franchiseKm = rule.franchiseKmByZone[context.travel.zone];
  const billableKm = Math.max(0, (context.travel.fromCabinetKm - franchiseKm) * 2);
  if (billableKm > 0) {
    const tariffCode = rule.tariffCodeByZone[context.travel.zone];
    const tariff = selectTariff(ruleset, tariffCode, context.date);
    if (tariff === undefined) {
      alerts.push({ severity: "blocking", code: "NO_IK_TARIFF", message: "Tarif IK absent.", ruleId: rule.id });
    } else {
      lines.push(createFixedLine("travel-ik", "travel", tariff, rule, billableKm));
    }
  }
  addAppliedRule(appliedRules, rule);
}

function addMajorations(
  lines: CodingLine[],
  context: CodingContext,
  ruleset: Ruleset,
  alerts: Alert[],
  appliedRules: Map<string, RuleRef>,
): void {
  const timeRule = selectRule(ruleset, "time_majoration", context.date);
  if (timeRule !== undefined) {
    if (context.visit.isSunday || context.visit.isHoliday) {
      const tariff = selectTariff(ruleset, timeRule.sundayHolidayTariffCode, context.date);
      if (tariff !== undefined) lines.push(createFixedLine("majoration-sunday-holiday", "majoration", tariff, timeRule));
      addAppliedRule(appliedRules, timeRule);
    }
    if (context.visit.isNight) {
      if (context.visit.nightPeriod === undefined) {
        alerts.push({
          severity: "blocking",
          code: "NIGHT_PERIOD_REQUIRED",
          message: "Précisez la plage horaire de nuit pour sélectionner la majoration exacte.",
          ruleId: timeRule.id,
        });
      } else {
        const tariff = selectTariff(
          ruleset,
          timeRule.nightTariffCodeByPeriod[context.visit.nightPeriod],
          context.date,
        );
        if (tariff !== undefined) lines.push(createFixedLine("majoration-night", "majoration", tariff, timeRule));
      }
      addAppliedRule(appliedRules, timeRule);
    }
  }

  const ageRule = selectRule(ruleset, "age_majoration", context.date);
  if (ageRule !== undefined && context.patient.age < ageRule.youngerThan) {
    const tariff = selectTariff(ruleset, ageRule.tariffCode, context.date);
    if (tariff !== undefined) lines.push(createFixedLine("majoration-child", "majoration", tariff, ageRule));
    addAppliedRule(appliedRules, ageRule);
  }
}

function addOpportunities(
  context: CodingContext,
  ruleset: Ruleset,
  alerts: Alert[],
  appliedRules: Map<string, RuleRef>,
): void {
  const rule = selectRule(ruleset, "opportunity", context.date);
  if (rule === undefined || !context.patient[rule.requiredPatientFlag]) return;
  if (!context.acts.some(({ tags }) => tags.includes(rule.requiredActTag))) return;
  const tariff = selectTariff(ruleset, rule.tariffCode, context.date);
  alerts.push({
    severity: "opportunity",
    code: rule.alertCode,
    message: rule.explanation,
    ruleId: rule.id,
    ...(tariff === undefined ? {} : { potentialGainCents: tariff.amountCents }),
  });
  addAppliedRule(appliedRules, rule);
}

function actToLine(act: WorkingAct, index: number): CodingLine {
  return {
    id: `act-${index + 1}`,
    kind: "act",
    catalogId: act.catalog.id,
    label: act.catalog.label,
    code: act.catalog.letterKey,
    coefficient: act.catalog.coefficient,
    quantity: act.quantity,
    baseAmountCents: act.baseAmountCents,
    appliedRate: act.rate,
    amountCents: Math.round(act.baseAmountCents * act.rate),
    appliedRuleIds: act.ruleIds,
  };
}

export function evaluateWithRuleset(contextInput: CodingContext, ruleset: Ruleset): CodingResult {
  const parsed = codingContextSchema.safeParse(contextInput);
  if (!parsed.success) {
    throw new NgapInputError(parsed.error.issues.map(({ message }) => message).join("; "));
  }
  const context = parsed.data;
  const alerts: Alert[] = [];
  const appliedRules = new Map<string, RuleRef>();
  const acts = resolveActs(context, ruleset, alerts);
  applyCumul(acts, context, ruleset, alerts, appliedRules);
  const lines = acts.map(actToLine);
  addTravel(lines, context, ruleset, alerts, appliedRules);
  addMajorations(lines, context, ruleset, alerts, appliedRules);
  addOpportunities(context, ruleset, alerts, appliedRules);

  const resultRules = [...appliedRules.values()];
  const hasUnverifiedData = [
    ...resultRules,
    ...acts.map(({ catalog }) => catalog),
    ...acts.map(({ tariff }) => tariff),
  ].some(({ status }) => status === "TO_VERIFY");

  return {
    lines,
    totalCents: lines.reduce((total, { amountCents }) => total + amountCents, 0),
    alerts,
    appliedRules: resultRules,
    explanation: {
      summary: `${lines.length} ligne(s) proposées. Validation professionnelle obligatoire.`,
      items: lines.map((line) => ({
        lineId: line.id,
        title: line.label,
        detail:
          line.kind === "act"
            ? `${line.code} ${line.coefficient?.toLocaleString("fr-FR")} × ${line.quantity}, taux ${(line.appliedRate * 100).toLocaleString("fr-FR")} %.`
            : `${line.code} ajouté selon le contexte du passage.`,
        ruleIds: line.appliedRuleIds,
      })),
    },
    confidence: alerts.some(({ severity }) => severity === "blocking")
      ? "ambiguous"
      : hasUnverifiedData
        ? "ambiguous"
        : "certain",
  };
}
