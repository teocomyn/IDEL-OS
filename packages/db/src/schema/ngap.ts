import { boolean, date, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { carePlans, visits } from "./care.js";
import { organizations, users } from "./core.js";
import { aiProposalKindEnum, alertSeverityEnum, codingLineTypeEnum, codingProposerEnum, codingStatusEnum, humanDecisionEnum } from "./enums.js";

export const actCatalog = pgTable("act_catalog", {
  id: uuid("id").defaultRandom().primaryKey(),
  keyLetter: text("key_letter").notNull(),
  coefficient: numeric("coefficient", { precision: 8, scale: 3 }).notNull(),
  label: text("label").notNull(),
  description: text("description").notNull(),
  ngapArticleRef: text("ngap_article_ref").notNull(),
  category: text("category").notNull(),
  requiresPrescription: boolean("requires_prescription").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  validFrom: date("valid_from").notNull(),
  validUntil: date("valid_until"),
  tariffCents: integer("tariff_cents").notNull(),
  metadataJson: jsonb("metadata_json").notNull().default({}),
});

export const ngapRules = pgTable("ngap_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull(),
  version: text("version").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  ngapArticleRef: text("ngap_article_ref").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceDate: date("source_date").notNull(),
  conditionJson: jsonb("condition_json").notNull(),
  effectJson: jsonb("effect_json").notNull(),
  severity: alertSeverityEnum("severity").notNull(),
  verificationStatus: text("verification_status").default("TO_VERIFY").notNull(),
  isActive: boolean("is_active").default(false).notNull(),
  validFrom: date("valid_from").notNull(),
  validUntil: date("valid_until"),
});

export const aiProposals = pgTable("ai_proposals", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  kind: aiProposalKindEnum("kind").notNull(),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  inputRedactedJson: jsonb("input_redacted_json").notNull(),
  outputJson: jsonb("output_json").notNull(),
  latencyMs: integer("latency_ms").notNull(),
  tokensIn: integer("tokens_in").notNull(),
  tokensOut: integer("tokens_out").notNull(),
  costCents: integer("cost_cents").notNull(),
  humanDecision: humanDecisionEnum("human_decision").default("pending").notNull(),
  humanDiffJson: jsonb("human_diff_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const codings = pgTable("codings", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  visitId: uuid("visit_id").references(() => visits.id),
  carePlanId: uuid("care_plan_id").references(() => carePlans.id),
  proposedBy: codingProposerEnum("proposed_by").notNull(),
  status: codingStatusEnum("status").default("proposed").notNull(),
  totalCents: integer("total_cents").notNull(),
  explanationMd: text("explanation_md").notNull(),
  aiProposalId: uuid("ai_proposal_id").references(() => aiProposals.id),
  validatedByUserId: uuid("validated_by_user_id").references(() => users.id),
  validatedAt: timestamp("validated_at", { withTimezone: true }),
  exportedAt: timestamp("exported_at", { withTimezone: true }),
  exportTarget: text("export_target"),
});

export const codingLines = pgTable("coding_lines", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  codingId: uuid("coding_id").notNull().references(() => codings.id, { onDelete: "cascade" }),
  actCatalogId: uuid("act_catalog_id").references(() => actCatalog.id),
  keyLetter: text("key_letter").notNull(),
  coefficient: numeric("coefficient", { precision: 8, scale: 3 }).notNull(),
  quantity: numeric("quantity", { precision: 8, scale: 2 }).notNull(),
  appliedRate: numeric("applied_rate", { precision: 5, scale: 4 }).notNull(),
  amountCents: integer("amount_cents").notNull(),
  lineType: codingLineTypeEnum("line_type").notNull(),
  ruleIds: uuid("rule_ids").array().notNull(),
  justification: text("justification").notNull(),
});

export const codingAlerts = pgTable("coding_alerts", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  codingId: uuid("coding_id").notNull().references(() => codings.id, { onDelete: "cascade" }),
  ruleId: uuid("rule_id").references(() => ngapRules.id),
  severity: alertSeverityEnum("severity").notNull(),
  message: text("message").notNull(),
  potentialGainCents: integer("potential_gain_cents"),
  acknowledgedBy: uuid("acknowledged_by").references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
});
