import { index, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { visits } from "./care.js";
import { organizations, users } from "./core.js";
import { transmissionStatusEnum } from "./enums.js";
import { aiProposals } from "./ngap.js";
import { patients } from "./patients.js";

export const transmissions = pgTable("transmissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  visitId: uuid("visit_id").notNull().references(() => visits.id),
  patientId: uuid("patient_id").notNull().references(() => patients.id),
  authorUserId: uuid("author_user_id").notNull().references(() => users.id),
  audioUrl: text("audio_url"),
  audioDurationS: integer("audio_duration_s"),
  transcriptionMode: text("transcription_mode").notNull().default("manual"),
  rawTranscriptEnc: text("raw_transcript_enc"),
  structuredJsonEnc: text("structured_json_enc"),
  finalTextEnc: text("final_text_enc"),
  status: transmissionStatusEnum("status").default("draft").notNull(),
  validatedAt: timestamp("validated_at", { withTimezone: true }),
  validatedByUserId: uuid("validated_by_user_id").references(() => users.id),
  aiProposalId: uuid("ai_proposal_id").references(() => aiProposals.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const transmissionReceipts = pgTable("transmission_receipts", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  transmissionId: uuid("transmission_id").notNull().references(() => transmissions.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  readAt: timestamp("read_at", { withTimezone: true }),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("transmission_receipts_unique").on(table.transmissionId, table.userId),
  index("transmission_receipts_org_user_idx").on(table.orgId, table.userId),
]);

export const vitalSigns = pgTable("vital_signs", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  patientId: uuid("patient_id").notNull().references(() => patients.id),
  visitId: uuid("visit_id").notNull().references(() => visits.id),
  type: text("type").notNull(),
  value: numeric("value", { precision: 10, scale: 3 }).notNull(),
  value2: numeric("value2", { precision: 10, scale: 3 }),
  unit: text("unit").notNull(),
  measuredAt: timestamp("measured_at", { withTimezone: true }).notNull(),
  source: text("source").notNull(),
});
