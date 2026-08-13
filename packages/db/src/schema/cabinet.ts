import { boolean, date, index, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { visits } from "./care.js";
import { organizations, users } from "./core.js";
import {
  assignmentChangeStatusEnum,
  messageDraftStatusEnum,
  replacementContractStatusEnum,
  retrocessionStatusEnum,
} from "./enums.js";
import { patients } from "./patients.js";

export const patientAccessGrants = pgTable("patient_access_grants", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  patientId: uuid("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  canRead: boolean("can_read").default(false).notNull(),
  canCare: boolean("can_care").default(false).notNull(),
  canTransmit: boolean("can_transmit").default(false).notNull(),
  canSchedule: boolean("can_schedule").default(false).notNull(),
  canBill: boolean("can_bill").default(false).notNull(),
  grantedByUserId: uuid("granted_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("patient_access_grants_org_user_period_idx").on(table.orgId, table.userId, table.startsAt, table.endsAt),
  index("patient_access_grants_org_patient_idx").on(table.orgId, table.patientId),
]);

export const replacementContracts = pgTable("replacement_contracts", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  incumbentUserId: uuid("incumbent_user_id").notNull().references(() => users.id),
  replacementUserId: uuid("replacement_user_id").notNull().references(() => users.id),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on").notNull(),
  retrocessionRate: numeric("retrocession_rate", { precision: 5, scale: 2 }).notNull(),
  status: replacementContractStatusEnum("status").default("draft").notNull(),
  documentUrl: text("document_url"),
  validatedByUserId: uuid("validated_by_user_id").references(() => users.id),
  validatedAt: timestamp("validated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("replacement_contracts_org_period_idx").on(table.orgId, table.startsOn, table.endsOn)]);

export const professionalDocuments = pgTable("professional_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  name: text("name").notNull(),
  fileUrl: text("file_url").notNull(),
  expiresAt: date("expires_at"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  uploadedByUserId: uuid("uploaded_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("professional_documents_org_expiry_idx").on(table.orgId, table.expiresAt)]);

export const messageDrafts = pgTable("message_drafts", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "set null" }),
  channel: text("channel").notNull(),
  recipientEnc: text("recipient_enc").notNull(),
  subjectEnc: text("subject_enc").notNull(),
  bodyEnc: text("body_enc").notNull(),
  status: messageDraftStatusEnum("status").default("draft").notNull(),
  generatedFromRuleKey: text("generated_from_rule_key"),
  createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id),
  validatedByUserId: uuid("validated_by_user_id").references(() => users.id),
  validatedAt: timestamp("validated_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("message_drafts_org_status_idx").on(table.orgId, table.status, table.createdAt)]);

export const visitAssignmentChanges = pgTable("visit_assignment_changes", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  visitId: uuid("visit_id").notNull().references(() => visits.id, { onDelete: "cascade" }),
  fromUserId: uuid("from_user_id").references(() => users.id),
  toUserId: uuid("to_user_id").notNull().references(() => users.id),
  reason: text("reason").notNull(),
  status: assignmentChangeStatusEnum("status").default("proposed").notNull(),
  proposedByUserId: uuid("proposed_by_user_id").notNull().references(() => users.id),
  appliedByUserId: uuid("applied_by_user_id").references(() => users.id),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("visit_assignment_changes_org_visit_idx").on(table.orgId, table.visitId, table.createdAt)]);

export const retrocessionPeriods = pgTable("retrocession_periods", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  incumbentUserId: uuid("incumbent_user_id").notNull().references(() => users.id),
  replacementUserId: uuid("replacement_user_id").notNull().references(() => users.id),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  grossAmountCents: integer("gross_amount_cents").notNull(),
  rate: numeric("rate", { precision: 5, scale: 2 }).notNull(),
  amountCents: integer("amount_cents").notNull(),
  status: retrocessionStatusEnum("status").default("draft").notNull(),
  preparedByUserId: uuid("prepared_by_user_id").notNull().references(() => users.id),
  validatedByUserId: uuid("validated_by_user_id").references(() => users.id),
  validatedAt: timestamp("validated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("retrocession_periods_unique").on(table.orgId, table.replacementUserId, table.periodStart, table.periodEnd),
]);

export const cabinetNotifications = pgTable("cabinet_notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  severity: text("severity").notNull(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  resourceType: text("resource_type"),
  resourceId: uuid("resource_id"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("cabinet_notifications_org_user_idx").on(table.orgId, table.userId, table.readAt)]);
