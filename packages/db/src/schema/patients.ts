import { boolean, date, index, jsonb, pgTable, point, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { organizations, users } from "./core.js";
import { mobilityEnum } from "./enums.js";

export const patients = pgTable(
  "patients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    firstNameEnc: text("first_name_enc").notNull(),
    lastNameEnc: text("last_name_enc").notNull(),
    birthDateEnc: text("birth_date_enc").notNull(),
    nirEnc: text("nir_enc"),
    phoneEnc: text("phone_enc"),
    emailEnc: text("email_enc"),
    notesEnc: text("notes_enc"),
    addressLineEnc: text("address_line_enc").notNull(),
    postalCode: text("postal_code").notNull(),
    city: text("city").notNull(),
    geo: point("geo", { mode: "xy" }),
    accessNotesEnc: text("access_notes_enc"),
    mobility: mobilityEnum("mobility").notNull(),
    isAld: boolean("is_ald").default(false).notNull(),
    aldDetailsEnc: text("ald_details_enc"),
    isDiabetic: boolean("is_diabetic").default(false).notNull(),
    preferredTimeWindows: jsonb("preferred_time_windows").notNull().default([]),
    exemptionType: text("exemption_type"),
    mutuelleJson: jsonb("mutuelle_json"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("patients_org_idx").on(table.orgId), index("patients_location_idx").on(table.postalCode, table.city)],
);

export const patientContacts = pgTable("patient_contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  patientId: uuid("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  nameEnc: text("name_enc").notNull(),
  phoneEnc: text("phone_enc"),
  emailEnc: text("email_enc"),
  notesEnc: text("notes_enc"),
});

export const prescribers = pgTable("prescribers", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  rpps: text("rpps").notNull(),
  speciality: text("speciality"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  isFavorite: boolean("is_favorite").default(false).notNull(),
});

export const pharmacies = pgTable("pharmacies", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address").notNull(),
  phone: text("phone"),
  email: text("email"),
});

export const consents = pgTable("consents", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  patientId: uuid("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  evidenceUrl: text("evidence_url"),
});

export const privacyRequests = pgTable("privacy_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  patientId: uuid("patient_id").notNull().references(() => patients.id),
  requestedByUserId: uuid("requested_by_user_id").notNull().references(() => users.id),
  kind: text("kind").notNull(),
  reasonEnc: text("reason_enc"),
  status: text("status").notNull().default("pending"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  retentionReviewedAt: date("retention_reviewed_at"),
});
