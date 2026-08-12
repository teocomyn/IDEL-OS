import { z } from "zod";

export const ruleStatusSchema = z.enum(["TO_VERIFY", "VERIFIED"]);
export type RuleStatus = z.infer<typeof ruleStatusSchema>;

export const sourceSchema = z.object({
  url: z.url(),
  title: z.string().min(1),
  retrievedAt: z.iso.date(),
  reference: z.string().min(1),
});
export type RuleSource = z.infer<typeof sourceSchema>;

const datedEntrySchema = z.object({
  id: z.string().min(1),
  status: ruleStatusSchema,
  active: z.boolean(),
  validFrom: z.iso.date(),
  validUntil: z.iso.date().nullable(),
  source: sourceSchema,
});

export const catalogActSchema = datedEntrySchema.extend({
  label: z.string().min(1),
  letterKey: z.string().min(1),
  coefficient: z.number().positive(),
  tags: z.array(z.string()),
  maxQuantityPerVisit: z.number().int().positive().nullable(),
});
export type CatalogAct = z.infer<typeof catalogActSchema>;

export const tariffSchema = datedEntrySchema.extend({
  code: z.string().min(1),
  label: z.string().min(1),
  amountCents: z.number().int().nonnegative(),
});
export type Tariff = z.infer<typeof tariffSchema>;

const ruleBaseSchema = datedEntrySchema.extend({
  version: z.string().min(1),
  title: z.string().min(1),
  ngapArticleRef: z.string().min(1),
  explanation: z.string().min(1),
});

export const ruleSchema = z.discriminatedUnion("type", [
  ruleBaseSchema.extend({
    type: z.literal("cumul"),
    rates: z.array(z.number().min(0).max(1)).min(1),
    defaultRate: z.number().min(0).max(1),
    fullRateTag: z.string().min(1),
  }),
  ruleBaseSchema.extend({
    type: z.literal("exclusive_tag"),
    tag: z.string().min(1),
    alertCode: z.string().min(1),
  }),
  ruleBaseSchema.extend({
    type: z.literal("travel"),
    ifdTariffCode: z.string().min(1),
    tariffCodeByZone: z.record(z.enum(["plaine", "montagne", "pied"]), z.string()),
    franchiseKmByZone: z.record(z.enum(["plaine", "montagne", "pied"]), z.number().nonnegative()),
  }),
  ruleBaseSchema.extend({
    type: z.literal("time_majoration"),
    sundayHolidayTariffCode: z.string().min(1),
    nightTariffCodeByPeriod: z.record(
      z.enum(["20-23_or_5-8", "23-5"]),
      z.string(),
    ),
  }),
  ruleBaseSchema.extend({
    type: z.literal("age_majoration"),
    youngerThan: z.number().int().positive(),
    tariffCode: z.string().min(1),
  }),
  ruleBaseSchema.extend({
    type: z.literal("opportunity"),
    requiredPatientFlag: z.enum(["isALD", "isDiabetic"]),
    requiredActTag: z.string().min(1),
    tariffCode: z.string().min(1),
    alertCode: z.string().min(1),
  }),
]);
export type Rule = z.infer<typeof ruleSchema>;

export const rulesetSchema = z.object({
  version: z.string().min(1),
  catalog: z.array(catalogActSchema).min(1),
  tariffs: z.array(tariffSchema).min(1),
  rules: z.array(ruleSchema).min(1),
});
export type Ruleset = z.infer<typeof rulesetSchema>;

export const codingContextSchema = z.object({
  patient: z.object({
    isALD: z.boolean(),
    isDiabetic: z.boolean(),
    age: z.number().int().min(0).max(130),
    exemption: z.enum(["ALD", "maternity", "AT_MP", "C2S"]).optional(),
  }),
  visit: z.object({
    at: z.date(),
    isSunday: z.boolean(),
    isHoliday: z.boolean(),
    isNight: z.boolean(),
    nightPeriod: z.enum(["20-23_or_5-8", "23-5"]).optional(),
    isHomeVisit: z.boolean(),
  }),
  acts: z
    .array(
      z.object({
        catalogId: z.string().min(1),
        quantity: z.number().int().positive(),
        tags: z.array(z.string()),
      }),
    )
    .min(1),
  travel: z.object({
    fromCabinetKm: z.number().nonnegative(),
    zone: z.enum(["plaine", "montagne", "pied"]),
    isFirstOfTour: z.boolean(),
  }),
  history: z.object({
    sameDayVisits: z.array(z.object({ id: z.string(), at: z.date() })),
    seriesProgress: z.record(z.string(), z.number().int().nonnegative()),
  }),
  date: z.date(),
});
export type CodingContext = z.infer<typeof codingContextSchema>;

export type CodingLine = {
  id: string;
  kind: "act" | "majoration" | "travel";
  catalogId: string | null;
  label: string;
  code: string;
  coefficient: number | null;
  quantity: number;
  baseAmountCents: number;
  appliedRate: number;
  amountCents: number;
  appliedRuleIds: string[];
};

export type Alert = {
  severity: "blocking" | "warning" | "info" | "opportunity";
  code: string;
  message: string;
  ruleId: string | null;
  potentialGainCents?: number;
};

export type RuleRef = {
  id: string;
  version: string;
  title: string;
  status: RuleStatus;
  source: RuleSource;
};

export type Explanation = {
  summary: string;
  items: Array<{
    lineId: string;
    title: string;
    detail: string;
    ruleIds: string[];
  }>;
};

export type CodingResult = {
  lines: CodingLine[];
  totalCents: number;
  alerts: Alert[];
  appliedRules: RuleRef[];
  explanation: Explanation;
  confidence: "certain" | "likely" | "ambiguous";
};

export type NgapEnvironment = "development" | "test" | "production";
