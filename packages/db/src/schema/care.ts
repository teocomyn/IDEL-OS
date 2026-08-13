import { boolean, date, index, integer, jsonb, numeric, pgTable, point, text, time, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organizations, users } from "./core.js";
import { carePlanStatusEnum, prescriptionSourceEnum, prescriptionStatusEnum, visitExceptionTypeEnum, visitStatusEnum } from "./enums.js";
import { patients, prescribers } from "./patients.js";

export const prescriptions = pgTable("prescriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  patientId: uuid("patient_id").notNull().references(() => patients.id),
  prescriberId: uuid("prescriber_id").references(() => prescribers.id),
  source: prescriptionSourceEnum("source").notNull(),
  originalFileUrl: text("original_file_url"),
  prescribedAt: date("prescribed_at"),
  validFrom: date("valid_from"),
  validUntil: date("valid_until"),
  isRenewal: boolean("is_renewal").default(false).notNull(),
  renewsPrescriptionId: uuid("renews_prescription_id"),
  rawOcrTextEnc: text("raw_ocr_text_enc"),
  extractionJson: jsonb("extraction_json"),
  extractionConfidence: numeric("extraction_confidence", { precision: 5, scale: 4 }),
  status: prescriptionStatusEnum("status").default("draft").notNull(),
  validatedByUserId: uuid("validated_by_user_id").references(() => users.id),
  validatedAt: timestamp("validated_at", { withTimezone: true }),
});

export const prescriptionItems = pgTable("prescription_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  prescriptionId: uuid("prescription_id").notNull().references(() => prescriptions.id, { onDelete: "cascade" }),
  rawText: text("raw_text").notNull(),
  actType: text("act_type").notNull(),
  description: text("description").notNull(),
  frequencyJson: jsonb("frequency_json").notNull(),
  durationDays: integer("duration_days"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  constraintsJson: jsonb("constraints_json").notNull().default({}),
  extractionConfidence: numeric("extraction_confidence", { precision: 5, scale: 4 }),
  needsReview: boolean("needs_review").default(true).notNull(),
});

export const carePlans = pgTable("care_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  patientId: uuid("patient_id").notNull().references(() => patients.id),
  prescriptionId: uuid("prescription_id").notNull().references(() => prescriptions.id),
  name: text("name").notNull(),
  status: carePlanStatusEnum("status").notNull(),
  startsAt: date("starts_at").notNull(),
  endsAt: date("ends_at"),
});

export const carePlanItems = pgTable("care_plan_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  carePlanId: uuid("care_plan_id").notNull().references(() => carePlans.id, { onDelete: "cascade" }),
  prescriptionItemId: uuid("prescription_item_id").references(() => prescriptionItems.id),
  actCatalogId: uuid("act_catalog_id").notNull(),
  estimatedDurationMin: integer("estimated_duration_min").notNull(),
  requiresTwoNurses: boolean("requires_two_nurses").default(false).notNull(),
  notes: text("notes"),
});

export const visits = pgTable(
  "visits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id").notNull().references(() => patients.id),
    carePlanId: uuid("care_plan_id").notNull().references(() => carePlans.id),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    timeWindowStart: time("time_window_start"),
    timeWindowEnd: time("time_window_end"),
    estimatedDurationMin: integer("estimated_duration_min").notNull(),
    assignedUserId: uuid("assigned_user_id").references(() => users.id),
    status: visitStatusEnum("status").default("planned").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    geoCheckin: point("geo_checkin", { mode: "xy" }),
    geoCheckout: point("geo_checkout", { mode: "xy" }),
    tourId: uuid("tour_id"),
    positionInTour: integer("position_in_tour"),
    hardTimeWindow: boolean("hard_time_window").default(false).notNull(),
    preferredUserId: uuid("preferred_user_id").references(() => users.id),
    routingConstraintsJson: jsonb("routing_constraints_json").notNull().default({}),
  },
  (table) => [index("visits_org_scheduled_idx").on(table.orgId, table.scheduledAt)],
);

export const visitActs = pgTable("visit_acts", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  visitId: uuid("visit_id").notNull().references(() => visits.id, { onDelete: "cascade" }),
  carePlanItemId: uuid("care_plan_item_id").notNull().references(() => carePlanItems.id),
  actCatalogId: uuid("act_catalog_id").notNull(),
  performed: boolean("performed").default(false).notNull(),
  quantity: numeric("quantity", { precision: 8, scale: 2 }).default("1").notNull(),
  notesEnc: text("notes_enc"),
});

export const visitExceptions = pgTable("visit_exceptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  visitId: uuid("visit_id").notNull().references(() => visits.id, { onDelete: "cascade" }),
  recordedByUserId: uuid("recorded_by_user_id").notNull().references(() => users.id),
  idempotencyKey: text("idempotency_key").notNull(),
  type: visitExceptionTypeEnum("type").notNull(),
  noteEnc: text("note_enc"),
  previousScheduledAt: timestamp("previous_scheduled_at", { withTimezone: true }),
  rescheduledAt: timestamp("rescheduled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("visit_exceptions_org_idempotency_unique").on(table.orgId, table.idempotencyKey)]);
